// Firestore data access, one function per operation from
// docs/DATABASE_SCHEMA.md — the JS equivalent of the Flutter build's
// repository layer. Dispatched to from js/data.js when a real Firebase
// project is configured; js/data-local.js is the Local Test Mode
// equivalent. Views only ever import js/data.js, never this file directly.
import {
  db,
  storage,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  storageRef,
  uploadBytes,
  getDownloadURL,
  FIREBASE_SDK_CDN,
} from "./firebase.js";
import { genId } from "./util.js";

// --- Fest settings (Madrasa name, shown on posters) ------------------------
export function watchFestSettings(festId, cb) {
  return onSnapshot(doc(db, "fests", festId), (d) => cb(d.exists() ? d.data() : {}));
}
export async function updateFestSettings(festId, settings) {
  await setDoc(doc(db, "fests", festId), settings, { merge: true });
}

// --- Groups -----------------------------------------------------------
// A fest can have any number of groups (commonly 2, but some fests run 3+
// teams) — Group is a plain admin-managed collection, not a fixed pair.
export function watchGroups(festId, cb) {
  return onSnapshot(collection(db, "fests", festId, "groups"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}
export function watchGroupTotals(festId, cb) {
  return onSnapshot(collection(db, "fests", festId, "groupTotals"), (snap) =>
    cb(snap.docs.map((d) => ({ groupId: d.id, ...d.data() }))),
  );
}
export async function addGroup(festId, group) {
  const id = group.id || genId();
  await setDoc(doc(db, "fests", festId, "groups", id), { ...group, id });
}
export async function updateGroup(festId, group) {
  await updateDoc(doc(db, "fests", festId, "groups", group.id), group);
}
export async function deleteGroup(festId, groupId) {
  await deleteDoc(doc(db, "fests", festId, "groups", groupId));
}

// --- Categories ---------------------------------------------------------
export function watchCategories(festId, cb) {
  return onSnapshot(
    query(collection(db, "fests", festId, "categories"), orderBy("sortOrder")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}
export async function addCategory(festId, category) {
  const id = category.id || genId();
  await setDoc(doc(db, "fests", festId, "categories", id), { ...category, id });
}
export async function updateCategory(festId, category) {
  await updateDoc(doc(db, "fests", festId, "categories", category.id), category);
}
export async function deleteCategory(festId, categoryId) {
  await deleteDoc(doc(db, "fests", festId, "categories", categoryId));
}

// --- Students -------------------------------------------------------------
export function watchStudents(festId, groupId, cb) {
  const base = collection(db, "fests", festId, "students");
  const q = groupId ? query(base, where("groupId", "==", groupId)) : base;
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function addStudent(festId, student) {
  const id = student.id || genId();
  await setDoc(doc(db, "fests", festId, "students", id), {
    ...student,
    id,
    createdAt: serverTimestamp(),
  });
}
export async function updateStudent(festId, student) {
  await updateDoc(doc(db, "fests", festId, "students", student.id), student);
}
export async function deleteStudent(festId, studentId) {
  await deleteDoc(doc(db, "fests", festId, "students", studentId));
}
export async function uploadStudentPhoto(_festId, studentId, canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  const ref = storageRef(storage, `students/${studentId}.jpg`);
  await uploadBytes(ref, blob, { contentType: "image/jpeg" });
  return getDownloadURL(ref);
}

// --- Items ------------------------------------------------------------------
export function watchItems(festId, categoryId, cb) {
  const base = collection(db, "fests", festId, "items");
  const q = categoryId ? query(base, where("categoryId", "==", categoryId)) : base;
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export function watchItem(festId, itemId, cb) {
  return onSnapshot(doc(db, "fests", festId, "items", itemId), (d) =>
    cb(d.exists() ? { id: d.id, ...d.data() } : null),
  );
}
export async function addItem(festId, item) {
  const id = item.id || genId();
  await setDoc(doc(db, "fests", festId, "items", id), { ...item, id, status: "pending" });
}
export async function updateItem(festId, item) {
  await updateDoc(doc(db, "fests", festId, "items", item.id), item);
}
export async function setItemStatus(festId, itemId, status) {
  await updateDoc(doc(db, "fests", festId, "items", itemId), { status });
}

// --- Registrations (flat top-level collection, filtered by itemId) --------
export function watchRegistrations(itemId, cb) {
  const q = query(collection(db, "registrations"), where("itemId", "==", itemId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function registerStudent(registration) {
  const id = registration.id || `${registration.itemId}_${registration.studentId}`;
  await setDoc(doc(db, "registrations", id), { ...registration, id, status: "registered" });
}
export async function withdrawRegistration(registrationId) {
  await updateDoc(doc(db, "registrations", registrationId), { status: "withdrawn" });
}

// --- Judges -------------------------------------------------------------
export function watchJudges(festId, cb) {
  return onSnapshot(collection(db, "fests", festId, "judges"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}
export async function addJudge(festId, judge) {
  const id = judge.id || genId();
  await setDoc(doc(db, "fests", festId, "judges", id), { ...judge, id, assignedItemIds: [] });
}
export async function assignJudgeToItems(judgeId, itemIds) {
  // Server-side: updates the judge's assignedItemIds AND their Firebase
  // Auth custom claims (assignedItems), which is what firestore.rules
  // checks — a client can't set its own custom claims. See
  // functions/src/index.ts assignJudgeToItems.
  const { getFunctions, httpsCallable } = await import(`${FIREBASE_SDK_CDN}/firebase-functions.js`);
  const call = httpsCallable(getFunctions(), "assignJudgeToItems");
  await call({ judgeId, itemIds });
}

// --- Scores -----------------------------------------------------------------
export function watchScoresByJudge(itemId, judgeId, cb) {
  const q = query(
    collection(db, "scores"),
    where("itemId", "==", itemId),
    where("judgeId", "==", judgeId),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function submitScore(score) {
  // Deterministic doc ID gives idempotent double-submit protection for
  // free; security rules make this collection create-only. See
  // docs/ARCHITECTURE.md §4-5.
  const id = `${score.registrationId}_${score.judgeId}`;
  await setDoc(doc(db, "scores", id), { ...score, id, submittedAt: serverTimestamp() });
}

// --- Results ----------------------------------------------------------------
export function watchPublishedResults(festId, cb) {
  const q = query(
    collection(db, "fests", festId, "results"),
    where("published", "==", true),
    orderBy("finalizedAt", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ itemId: d.id, ...d.data() }))));
}
export function watchAllResults(festId, cb) {
  return onSnapshot(collection(db, "fests", festId, "results"), (snap) =>
    cb(snap.docs.map((d) => ({ itemId: d.id, ...d.data() }))),
  );
}
export async function publishResult(festId, itemId) {
  await updateDoc(doc(db, "fests", festId, "results", itemId), { published: true });
}
