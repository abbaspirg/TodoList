// Firestore data access, one function per operation from
// docs/DATABASE_SCHEMA.md — the JS equivalent of the Flutter build's
// repository layer. Dispatched to from js/data.js when a real Firebase
// project is configured; js/data-local.js is the Local Test Mode
// equivalent. Views only ever import js/data.js, never this file directly.
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "./firebase.js";
import { genId } from "./util.js";
import { computeRankings, computeGroupTotals, isFullyScored } from "./scoring.js";

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
// Derived from results rather than stored as a running tally — see
// js/scoring.js computeGroupTotals. With clients (not one Cloud Function)
// finalizing items, an incremented total would double-count whenever two
// devices finalized the same item.
export function watchGroupTotals(festId, cb) {
  let results = null;
  let groups = null;
  const emit = () => {
    if (results && groups) cb(computeGroupTotals(results, groups));
  };
  const unsubResults = onSnapshot(collection(db, "fests", festId, "results"), (snap) => {
    results = snap.docs.map((d) => d.data());
    emit();
  });
  const unsubGroups = onSnapshot(collection(db, "fests", festId, "groups"), (snap) => {
    groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  return () => {
    unsubResults();
    unsubGroups();
  };
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
export async function uploadStudentPhoto(_festId, _studentId, canvas) {
  // Stored inline on the student document as a data URL rather than in
  // Cloud Storage, which now requires Firebase's paid Blaze plan. Safe at
  // this size: js/util.js resizeImageFile caps the image at 480px, giving
  // ~10-30KB — far inside Firestore's 1MB per-document limit — and it
  // keeps an institution's project entirely on the no-cost Spark plan.
  return canvas.toDataURL("image/jpeg", 0.82);
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
/** Admin-only (enforced by firestore.rules). Writes the assignment to the
 * judge document and mirrors it onto each item's assignedJudgeIds.
 *
 * This used to be a Cloud Function, because the rules checked a custom
 * auth claim and a client cannot set its own claims. Rules now read the
 * judge document directly instead, so no server is involved — see
 * firestore.rules and README "Why no Cloud Functions". */
export async function assignJudgeToItems(festId, judgeId, itemIds) {
  const batch = writeBatch(db);
  batch.update(doc(db, "fests", festId, "judges", judgeId), { assignedItemIds: itemIds });

  const itemsSnap = await getDocs(collection(db, "fests", festId, "items"));
  for (const itemDoc of itemsSnap.docs) {
    const assigned = new Set(itemDoc.data().assignedJudgeIds || []);
    const shouldHave = itemIds.includes(itemDoc.id);
    if (shouldHave === assigned.has(judgeId)) continue; // already correct
    if (shouldHave) assigned.add(judgeId);
    else assigned.delete(judgeId);
    batch.update(itemDoc.ref, { assignedJudgeIds: [...assigned] });
  }
  await batch.commit();
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
  await maybeFinalizeItem(score.festId, score.itemId);
}

/** Computes and writes an item's result once every assigned judge has
 * scored every participant — the client-side equivalent of what used to be
 * the onScoreWrite Cloud Function.
 *
 * Being client-side means the judge who submits the final score writes the
 * result. Rules restrict that write to admins and assigned judges, and
 * only an admin can publish; they cannot verify the arithmetic itself.
 * That's an accepted trade for staying on the no-cost plan — see README
 * "Why no Cloud Functions". Recomputation is naturally idempotent: the
 * result document is derived wholly from scores, so two devices finishing
 * at once write the same content. */
async function maybeFinalizeItem(festId, itemId) {
  const itemSnap = await getDoc(doc(db, "fests", festId, "items", itemId));
  if (!itemSnap.exists()) return;
  const item = itemSnap.data();
  const assignedJudgeIds = item.assignedJudgeIds || [];
  if (assignedJudgeIds.length === 0) return;

  const [regsSnap, scoresSnap] = await Promise.all([
    getDocs(query(collection(db, "registrations"), where("itemId", "==", itemId))),
    getDocs(query(collection(db, "scores"), where("itemId", "==", itemId))),
  ]);

  const registrations = regsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status !== "withdrawn");
  if (registrations.length === 0) return;

  const marksByReg = new Map();
  for (const s of scoresSnap.docs.map((d) => d.data())) {
    const list = marksByReg.get(s.registrationId) || [];
    list.push(s.totalMarks);
    marksByReg.set(s.registrationId, list);
  }
  if (!isFullyScored(registrations, marksByReg, assignedJudgeIds.length)) return;

  const rankings = computeRankings(registrations, marksByReg, item.maxScore || 10);
  const resultRef = doc(db, "fests", festId, "results", itemId);
  const existing = await getDoc(resultRef);

  await setDoc(resultRef, {
    itemId,
    itemName: item.name,
    rankings,
    finalizedAt: serverTimestamp(),
    // Never unpublish on recompute — a judge resubmitting after an admin
    // published shouldn't pull the result back off the public screen.
    published: Boolean(existing.exists() && existing.data().published),
  });
  await updateDoc(doc(db, "fests", festId, "items", itemId), { status: "completed" });
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
