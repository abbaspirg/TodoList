// A stand-in for js/firebase.js used only by the test harness.
//
// It implements the same small surface (the handful of Firestore and Auth
// functions this app calls) against localStorage, with a BroadcastChannel
// so several browser pages on the same machine see each other's writes.
// That lets a real seven-player game be played through the real UI —
// rooms.js, app.js, the views and the renderer all unmodified — without a
// Firebase project or a network.
//
// It is NOT a Firestore emulator and makes no attempt to be one: no
// security rules, and transactions are read-modify-write rather than truly
// atomic. It verifies the app's logic and wiring, not Firestore's.
// The rules in ludo/firestore.rules still have to be reviewed by hand.

const DB_KEY = "ludoFakeDb";
const channel = new BroadcastChannel("ludo-fake-db");

export const db = { __fake: true };

// --- Store -----------------------------------------------------------------

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(DB_KEY, JSON.stringify(store));
  channel.postMessage("changed");
  queueMicrotask(notifyAll);
}

function parentPath(path) {
  return path.slice(0, path.lastIndexOf("/"));
}

function lastSegment(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}

// --- References ------------------------------------------------------------

export function doc(_db, ...segments) {
  return { __path: segments.join("/"), id: segments[segments.length - 1] };
}

export function collection(_db, ...segments) {
  return { __path: segments.join("/"), __collection: true, __filters: [] };
}

export function query(ref, ...constraints) {
  return { ...ref, __filters: [...(ref.__filters || []), ...constraints] };
}

export function where(field, op, value) {
  return { field, op, value };
}

export function orderBy() {
  return { __ignored: true };
}

export function limit() {
  return { __ignored: true };
}

export function serverTimestamp() {
  return Date.now();
}

// --- Reads -----------------------------------------------------------------

function docSnapshot(path, store) {
  const data = store[path];
  return {
    id: lastSegment(path),
    ref: { __path: path, id: lastSegment(path) },
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : structuredClone(data)),
  };
}

function matches(data, filters) {
  return (filters || []).every((f) => {
    if (f.__ignored) return true;
    if (f.op === "==") return data?.[f.field] === f.value;
    if (f.op === "in") return f.value.includes(data?.[f.field]);
    if (f.op === "array-contains") return Array.isArray(data?.[f.field]) && data[f.field].includes(f.value);
    throw new Error(`fake-firebase does not implement the "${f.op}" operator`);
  });
}

function collectionDocs(ref, store) {
  return Object.keys(store)
    .filter((path) => parentPath(path) === ref.__path && matches(store[path], ref.__filters))
    .sort()
    .map((path) => docSnapshot(path, store));
}

export async function getDoc(ref) {
  return docSnapshot(ref.__path, readStore());
}

export async function getDocs(ref) {
  const docs = collectionDocs(ref, readStore());
  return { docs, empty: docs.length === 0, size: docs.length };
}

// --- Writes ----------------------------------------------------------------

export async function setDoc(ref, data, options = {}) {
  const store = readStore();
  store[ref.__path] = options.merge ? { ...(store[ref.__path] || {}), ...data } : structuredClone(data);
  writeStore(store);
}

export async function updateDoc(ref, data) {
  const store = readStore();
  if (!store[ref.__path]) throw new Error(`No document to update at ${ref.__path}`);
  store[ref.__path] = { ...store[ref.__path], ...structuredClone(data) };
  writeStore(store);
}

export async function deleteDoc(ref) {
  const store = readStore();
  delete store[ref.__path];
  // Deleting a document in real Firestore leaves its subcollections behind;
  // here the room delete is meant to clear the room, so drop descendants.
  for (const path of Object.keys(store)) {
    if (path.startsWith(ref.__path + "/")) delete store[path];
  }
  writeStore(store);
}

export async function addDoc(ref, data) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const path = `${ref.__path}/${id}`;
  const store = readStore();
  store[path] = structuredClone(data);
  writeStore(store);
  return { __path: path, id };
}

export async function runTransaction(_db, fn) {
  const store = readStore();
  const writes = [];
  const tx = {
    get: async (ref) => docSnapshot(ref.__path, store),
    set: (ref, data, options = {}) => writes.push({ kind: "set", ref, data, options }),
    update: (ref, data) => writes.push({ kind: "update", ref, data }),
    delete: (ref) => writes.push({ kind: "delete", ref }),
  };
  const result = await fn(tx);
  for (const write of writes) {
    if (write.kind === "set") await setDoc(write.ref, write.data, write.options);
    else if (write.kind === "update") await updateDoc(write.ref, write.data);
    else await deleteDoc(write.ref);
  }
  return result;
}

// --- Listeners -------------------------------------------------------------

const listeners = new Set();

export function onSnapshot(ref, cb, _errCb) {
  const entry = { ref, cb, previous: null, previousIds: [] };
  listeners.add(entry);
  queueMicrotask(() => fire(entry, readStore()));
  return () => listeners.delete(entry);
}

function fire(entry, store) {
  if (!listeners.has(entry)) return;
  const { ref, cb } = entry;

  if (ref.__collection) {
    const docs = collectionDocs(ref, store);
    const ids = docs.map((d) => d.id);
    const serialised = JSON.stringify(docs.map((d) => [d.id, d.data()]));
    if (serialised === entry.previous) return;
    const previousIds = entry.previousIds;
    entry.previous = serialised;
    entry.previousIds = ids;
    cb({
      docs,
      empty: docs.length === 0,
      size: docs.length,
      docChanges: () =>
        docs
          .filter((d) => !previousIds.includes(d.id))
          .map((d) => ({ type: "added", doc: d })),
    });
    return;
  }

  const snap = docSnapshot(ref.__path, store);
  const serialised = JSON.stringify(snap.data() ?? null);
  if (serialised === entry.previous) return;
  entry.previous = serialised;
  cb(snap);
}

function notifyAll() {
  const store = readStore();
  for (const entry of [...listeners]) fire(entry, store);
}

channel.onmessage = () => queueMicrotask(notifyAll);
// localStorage writes from another page also raise a storage event; both
// paths are harmless together because fire() skips unchanged data.
window.addEventListener("storage", (e) => {
  if (e.key === DB_KEY) queueMicrotask(notifyAll);
});

// --- Auth ------------------------------------------------------------------
// One uid per page. sessionStorage is per browsing context, so seven pages
// in one browser are seven distinct "devices" — exactly what is needed to
// play a seven-player game locally.

const UID_KEY = "ludoFakeUid";
let uid = sessionStorage.getItem(UID_KEY);
if (!uid) {
  uid = `u-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(UID_KEY, uid);
}

export const auth = { currentUser: { uid } };
const authListeners = new Set();

export function onAuthStateChanged(_auth, cb) {
  authListeners.add(cb);
  queueMicrotask(() => cb(auth.currentUser));
  return () => authListeners.delete(cb);
}

export async function signInAnonymously() {
  return { user: auth.currentUser };
}

export async function fbSignOut() {
  auth.currentUser = null;
  for (const cb of authListeners) cb(null);
}

// --- Module state the app checks on boot -----------------------------------

export const initError = null;
export function needsSetup() {
  return false;
}
export function hasFirebaseError() {
  return false;
}
export function whenFirebaseReady() {
  return Promise.resolve();
}
