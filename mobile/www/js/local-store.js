// A tiny reactive, localStorage-backed store used when running in Local
// Test Mode (see js/firebase.js isLocalMode()) — gives js/data-local.js the
// same "subscribe and get called on every change" shape as Firestore's
// onSnapshot, so views written against js/data.js don't need to know which
// backend is active.
const STORAGE_KEY = "madrasaFestLocalDB";

function seedDefaults() {
  return {
    groups: [
      { id: "group-a", festId: "current", name: "Green Brigade", colorHex: "#0f6e4f" },
      { id: "group-b", festId: "current", name: "Golden Team", colorHex: "#c9971f" },
    ],
    groupTotals: [],
    categories: [],
    students: [],
    items: [],
    judges: [],
    registrations: [],
    scores: [],
    results: [],
  };
}

// One-off repair for data written by a shipped bug: data-local.js's
// publishResult() used to upsert `{ itemId, published: true }` without an
// `id` field, which upsert() (below) matches existing docs on — so it
// never found the real result doc and pushed a second, empty one instead
// of publishing the first. Merges any `results` sharing an itemId back
// into one doc so devices that already hit this don't need a manual
// "Reset local data" to see their real, already-computed results.
function dedupeResults(db) {
  const byKey = new Map();
  for (const r of db.results || []) {
    const key = r.itemId || r.id;
    if (!key) continue;
    const prior = byKey.get(key);
    byKey.set(key, {
      ...prior,
      ...r,
      id: key,
      itemId: key,
      published: Boolean(prior?.published || r.published),
    });
  }
  db.results = [...byKey.values()];
  return db;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return dedupeResults({ ...seedDefaults(), ...parsed });
  } catch {
    return seedDefaults();
  }
}

let db = load();
persist(); // save the dedupe pass above so a device that hit the bug is fixed for good, not just this session

const listeners = new Map(); // collection name -> Set<callback>

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function notify(name) {
  const cbs = listeners.get(name);
  if (!cbs) return;
  for (const cb of cbs) cb(db[name] || []);
}

export function getAll(name) {
  return db[name] || [];
}

export function get(name, id) {
  return (db[name] || []).find((x) => x.id === id) ?? null;
}

/** Mirrors onSnapshot: fires once (async, matching Firestore's own async
 * first callback) with current data, then again on every mutation. Returns
 * an unsubscribe function. */
export function subscribe(name, cb) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(cb);
  Promise.resolve().then(() => cb(db[name] || []));
  return () => listeners.get(name)?.delete(cb);
}

export function upsert(name, item) {
  const list = db[name] || (db[name] = []);
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item };
  else list.push({ ...item });
  persist();
  notify(name);
  return db[name].find((x) => x.id === item.id);
}

export function remove(name, id) {
  db[name] = (db[name] || []).filter((x) => x.id !== id);
  persist();
  notify(name);
}

export function resetLocalData() {
  db = seedDefaults();
  persist();
  for (const name of Object.keys(db)) notify(name);
}
