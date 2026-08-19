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
import { genId, toast } from "./util.js";
import { computeRankings, computeGroupTotals, isFullyScored } from "./scoring.js";

// Every real-time read goes through here rather than calling onSnapshot
// directly. Firestore reports a rejected listener to the error callback
// and then simply never fires — with no error handler that looks exactly
// like "there is no data", which is how a rules problem once showed up as
// an empty "no items assigned to you" list instead of an error. Surfacing
// it costs nothing and turns a silent dead end into something diagnosable.
function listen(ref, cb) {
  return onSnapshot(ref, cb, (err) => {
    console.error("Firestore listener failed:", ref, err);
    toast(
      err?.code === "permission-denied"
        ? "You don't have permission to view this. Check the security rules are published."
        : "Lost connection to the database — check your internet.",
    );
  });
}

// --- Fest settings (Madrasa name, shown on posters) ------------------------
export function watchFestSettings(festId, cb) {
  return listen(doc(db, "fests", festId), (d) => cb(d.exists() ? d.data() : {}));
}
export async function updateFestSettings(festId, settings) {
  await setDoc(doc(db, "fests", festId), settings, { merge: true });
}

// --- Groups -----------------------------------------------------------
// A fest can have any number of groups (commonly 2, but some fests run 3+
// teams) — Group is a plain admin-managed collection, not a fixed pair.
export function watchGroups(festId, cb) {
  return listen(collection(db, "fests", festId, "groups"), (snap) =>
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
  // Published results only, for two reasons: standings shouldn't reveal an
  // item's outcome before it's announced, and the public leaderboard is
  // read by signed-out guests, whose rules only permit published documents
  // — an unfiltered query here is rejected outright rather than filtered,
  // so the whole screen would fail for them.
  const unsubResults = listen(
    query(collection(db, "fests", festId, "results"), where("published", "==", true)),
    (snap) => {
      results = snap.docs.map((d) => d.data());
      emit();
    },
  );
  const unsubGroups = listen(collection(db, "fests", festId, "groups"), (snap) => {
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
  return listen(
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
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function addStudent(festId, student) {
  const id = student.id || genId();
  await setDoc(doc(db, "fests", festId, "students", id), {
    ...student,
    id,
    createdAt: serverTimestamp(),
  });
}
/** Writes many students in one round trip — used by the sample-roster
 * seeder, where 100 sequential writes would take an age on a phone.
 * Firestore caps a batch at 500 operations, so this chunks. */
export async function addStudentsBulk(festId, students) {
  for (let i = 0; i < students.length; i += 400) {
    const batch = writeBatch(db);
    for (const student of students.slice(i, i + 400)) {
      batch.set(doc(db, "fests", festId, "students", student.id), { ...student, createdAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

/** Deletes many students and their registrations/marks — the cascade
 * deleteStudent does, batched. */
export async function deleteStudentsBulk(festId, studentIds) {
  for (const studentId of studentIds) await deleteStudent(festId, studentId);
}

export async function updateStudent(festId, student) {
  await updateDoc(doc(db, "fests", festId, "students", student.id), student);
}
/** Removes a student along with their registrations and any marks on them.
 *
 * Leaving the registrations behind would keep the student appearing in
 * judges' scoring lists after deletion, so they go too — and their scores
 * with them, since a score pointing at a registration that no longer
 * exists can never be interpreted again.
 *
 * Already-finalized results are unaffected: they denormalize studentName
 * and the marks at the time, so past results stay intact and readable. */
export async function deleteStudent(festId, studentId) {
  const regsSnap = await getDocs(query(collection(db, "registrations"), where("studentId", "==", studentId)));
  const scoreSnaps = await Promise.all(
    regsSnap.docs.map((r) => getDocs(query(collection(db, "scores"), where("registrationId", "==", r.id)))),
  );

  const batch = writeBatch(db);
  batch.delete(doc(db, "fests", festId, "students", studentId));
  for (const reg of regsSnap.docs) batch.delete(reg.ref);
  for (const snap of scoreSnaps) for (const s of snap.docs) batch.delete(s.ref);
  await batch.commit();
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
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export function watchItem(festId, itemId, cb) {
  return listen(doc(db, "fests", festId, "items", itemId), (d) =>
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

/** Removes an item and everything that only exists because of it: its
 * registrations, the marks against them, and its result. Group standings
 * are derived from results, so they correct themselves once the result
 * document is gone — there's no stored tally to unwind. */
export async function deleteItem(festId, itemId) {
  const [regsSnap, scoresSnap] = await Promise.all([
    getDocs(query(collection(db, "registrations"), where("itemId", "==", itemId))),
    getDocs(query(collection(db, "scores"), where("itemId", "==", itemId))),
  ]);

  const batch = writeBatch(db);
  batch.delete(doc(db, "fests", festId, "items", itemId));
  batch.delete(doc(db, "fests", festId, "results", itemId));
  for (const reg of regsSnap.docs) batch.delete(reg.ref);
  for (const s of scoresSnap.docs) batch.delete(s.ref);
  await batch.commit();
}

// --- Registrations (flat top-level collection, filtered by itemId) --------
export function watchRegistrations(itemId, cb) {
  const q = query(collection(db, "registrations"), where("itemId", "==", itemId));
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function registerStudent(registration) {
  const id = registration.id || `${registration.itemId}_${registration.studentId}`;
  await setDoc(doc(db, "registrations", id), { ...registration, id, status: "registered" });
}
export async function withdrawRegistration(registrationId) {
  await updateDoc(doc(db, "registrations", registrationId), { status: "withdrawn" });
}

// --- Judges -------------------------------------------------------------
/** Admin-only in practice: the rules let a judge read just their own
 * record, and Firestore rejects an unfiltered collection query rather than
 * trimming it to the readable documents. Judges use watchJudge below. */
export function watchJudges(festId, cb) {
  return listen(collection(db, "fests", festId, "judges"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/** A single judge's own record — what the Judge Panel needs to know which
 * items it's assigned to, and readable by that judge under the rules. */
export function watchJudge(festId, judgeId, cb) {
  return listen(doc(db, "fests", festId, "judges", judgeId), (d) =>
    cb(d.exists() ? { id: d.id, ...d.data() } : null),
  );
}
export async function addJudge(festId, judge) {
  const id = judge.id || genId();
  await setDoc(doc(db, "fests", festId, "judges", id), { ...judge, id, assignedItemIds: [] });
}

/** Writes the `roles/{uid}` document that tells the security rules (and the
 * app) what this account may do. Admin-only, enforced by firestore.rules.
 * The very first admin's document still has to be created by hand in the
 * Firebase console — nothing can grant the first role but the console. */
export async function setUserRole(uid, roleData) {
  await setDoc(doc(db, "roles", uid), roleData);
}

/** Removes a judge and revokes their access.
 *
 * Their already-submitted scores are deliberately kept: they're part of the
 * record of how a result was reached, and items they'd finished scoring
 * shouldn't silently change. Dropping them from assignedJudgeIds does mean
 * an item still waiting only on this judge can now finalize, which is the
 * behaviour you want when someone withdraws mid-fest.
 *
 * Their Firebase Auth account cannot be deleted from here — the client SDK
 * only lets a user delete themselves, and deleting someone else needs the
 * Admin SDK (a server). Deleting roles/{uid} revokes all access, which is
 * what actually matters; the dormant login can be removed in the Firebase
 * console if wanted. */
export async function deleteJudge(festId, judgeId, authUid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "fests", festId, "judges", judgeId));
  if (authUid) batch.delete(doc(db, "roles", authUid));

  const itemsSnap = await getDocs(collection(db, "fests", festId, "items"));
  for (const itemDoc of itemsSnap.docs) {
    const assigned = itemDoc.data().assignedJudgeIds || [];
    if (!assigned.includes(judgeId)) continue;
    batch.update(itemDoc.ref, { assignedJudgeIds: assigned.filter((id) => id !== judgeId) });
  }
  await batch.commit();
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
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function submitScore(score) {
  // Deterministic doc ID gives idempotent double-submit protection for
  // free; security rules make this collection create-only. See
  // docs/ARCHITECTURE.md §4-5.
  const id = `${score.registrationId}_${score.judgeId}`;
  await setDoc(doc(db, "scores", id), { ...score, id, submittedAt: serverTimestamp() });

  // The mark is safely stored by this point. Computing the result is a
  // separate step that can fail on its own (a stale rules deployment, a
  // dropped connection), and when it does the judge should not be told
  // their submission failed — nor left believing everything worked, which
  // is exactly how items sat "ongoing" with every mark in and no result.
  // Admin > Results retries any such item, so this is recoverable.
  try {
    await maybeFinalizeItem(score.festId, score.itemId);
  } catch (err) {
    console.error("Result computation failed after saving the mark:", err);
    toast("Mark saved, but the result couldn't be calculated yet — the admin can finish it from Results.");
  }
}

/** Finalizes any item whose marks are all in but whose result was never
 * written — the recovery path for the failure above.
 *
 * Called when an admin opens Results. It matters because marks are
 * create-once: if the finalizing write fails on the judge's device,
 * nothing on that device will ever retry it, and re-submitting is blocked.
 * Without this an item could be stuck "ongoing" forever with a full set of
 * marks. Runs as the admin, who can read everything. */
export async function finalizePendingItems(festId) {
  const itemsSnap = await getDocs(collection(db, "fests", festId, "items"));
  let finalized = 0;
  for (const itemDoc of itemsSnap.docs) {
    if (itemDoc.data().status === "completed") continue;
    if ((itemDoc.data().assignedJudgeIds || []).length === 0) continue;
    if (await maybeFinalizeItem(festId, itemDoc.id)) finalized++;
  }
  return finalized;
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
/** Recomputes an item's result from its current registrations and marks.
 *
 * `onlyIfComplete` is the difference between a judge submitting and an
 * admin editing. A judge's submission must never tear anything down when
 * the item isn't finished yet, so it passes true and this simply does
 * nothing. An admin editing data passes false, which also handles the
 * reverse direction: if their change means the item is no longer fully
 * scored — a participant added to a finished item, say — the stale result
 * is deleted and the item reopens for scoring, rather than leaving a
 * result on record that no longer matches the marks behind it.
 *
 * Returns true only when a result was written. */
async function recomputeResult(festId, itemId, { onlyIfComplete = false } = {}) {
  const itemSnap = await getDoc(doc(db, "fests", festId, "items", itemId));
  if (!itemSnap.exists()) return false;
  const item = itemSnap.data();
  const assignedJudgeIds = item.assignedJudgeIds || [];

  const [regsSnap, scoresSnap] = await Promise.all([
    getDocs(query(collection(db, "registrations"), where("itemId", "==", itemId))),
    getDocs(query(collection(db, "scores"), where("itemId", "==", itemId))),
  ]);
  const registrations = regsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status !== "withdrawn");

  const marksByReg = new Map();
  for (const sc of scoresSnap.docs.map((d) => d.data())) {
    const list = marksByReg.get(sc.registrationId) || [];
    list.push(sc.totalMarks);
    marksByReg.set(sc.registrationId, list);
  }

  const complete =
    assignedJudgeIds.length > 0 &&
    registrations.length > 0 &&
    isFullyScored(registrations, marksByReg, assignedJudgeIds.length);

  const resultRef = doc(db, "fests", festId, "results", itemId);

  if (!complete) {
    if (onlyIfComplete) return false;
    // Admin-initiated and no longer complete: drop the stale result and
    // put the item back where it belongs. Standings are derived from
    // results, so its points disappear with it.
    const existing = await getDoc(resultRef);
    if (existing.exists()) await deleteDoc(resultRef);
    if (item.status === "completed") {
      await updateDoc(doc(db, "fests", festId, "items", itemId), { status: "ongoing" });
    }
    return false;
  }

  const rankings = computeRankings(registrations, marksByReg, item.maxScore || 10);
  const existing = await getDoc(resultRef);
  await setDoc(resultRef, {
    itemId,
    itemName: item.name,
    rankings,
    finalizedAt: serverTimestamp(),
    // Never unpublish on recompute — a judge resubmitting, or an admin
    // correcting a mark, shouldn't pull an announced result off the
    // public screen. Unpublishing is its own deliberate action.
    published: Boolean(existing.exists() && existing.data().published),
  });
  await updateDoc(doc(db, "fests", festId, "items", itemId), { status: "completed" });
  return true;
}

/** Admin-only: re-derive an item's result after editing marks or
 * participants. Exported because those edits happen in views. */
export async function recomputeItemResult(festId, itemId) {
  return recomputeResult(festId, itemId);
}

async function maybeFinalizeItem(festId, itemId) {
  return recomputeResult(festId, itemId, { onlyIfComplete: true });
}

// --- Results ----------------------------------------------------------------
export function watchPublishedResults(festId, cb) {
  const q = query(
    collection(db, "fests", festId, "results"),
    where("published", "==", true),
    orderBy("finalizedAt", "desc"),
  );
  return listen(q, (snap) => cb(snap.docs.map((d) => ({ itemId: d.id, ...d.data() }))));
}
export function watchAllResults(festId, cb) {
  return listen(collection(db, "fests", festId, "results"), (snap) =>
    cb(snap.docs.map((d) => ({ itemId: d.id, ...d.data() }))),
  );
}
export async function publishResult(festId, itemId) {
  await updateDoc(doc(db, "fests", festId, "results", itemId), { published: true });
}

/** Takes an announced result back off the public screen. Its points leave
 * the standings too, since those are derived from published results. */
export async function unpublishResult(festId, itemId) {
  await updateDoc(doc(db, "fests", festId, "results", itemId), { published: false });
}

// --- Admin overrides ---------------------------------------------------------
// Judges cannot revise a mark once submitted (firestore.rules keeps scores
// create-once for them). An admin can, because someone has to be able to
// fix a mis-keyed mark or a participant entered against the wrong item,
// and with no server there is no back office to do it from.

/** Every judge's marks for one item — the admin's view of the raw data
 * behind a result. Judges use watchScoresByJudge, which shows only theirs. */
export function watchItemScores(itemId, cb) {
  return listen(query(collection(db, "scores"), where("itemId", "==", itemId)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/** Admin-only: overwrite a judge's mark, then re-derive the result so the
 * published standings can't disagree with the marks behind them. */
export async function overrideScore(festId, scoreId, totalMarks, itemId) {
  await updateDoc(doc(db, "scores", scoreId), { totalMarks, editedByAdminAt: serverTimestamp() });
  await recomputeResult(festId, itemId);
}

// --- Attendance ------------------------------------------------------------
// One document per student per day, id `${date}_${studentId}`, so marking
// the same student twice overwrites rather than accumulating. `date` is a
// local YYYY-MM-DD string, not a timestamp: attendance is a calendar fact,
// and a timestamp would put a late-evening mark on the previous day for
// anyone west of UTC.
//
// className is denormalized onto the record because it is the axis
// attendance is taken and read along. Deriving it from the student instead
// would silently rewrite history the moment a student moves up a class.

export function watchAttendance(festId, date, cb) {
  return listen(
    query(collection(db, "fests", festId, "attendance"), where("date", "==", date)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/** Every attendance record for the fest — what the report reads. The rule
 * on this collection is admin/judge with no per-document condition, so an
 * unfiltered collection query is allowed; a rule keyed on document fields
 * would need the query to mirror it. */
export function watchAllAttendance(festId, cb) {
  return listen(collection(db, "fests", festId, "attendance"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

export async function setAttendance(festId, record) {
  const id = `${record.date}_${record.studentId}`;
  await setDoc(doc(db, "fests", festId, "attendance", id), {
    ...record,
    id,
    markedAt: serverTimestamp(),
  });
}

/** Marks a whole class in one write — the "everyone is here" case, which
 * is the common one and would otherwise be one round trip per student. */
export async function setAttendanceBulk(festId, records) {
  const batch = writeBatch(db);
  for (const record of records) {
    const id = `${record.date}_${record.studentId}`;
    batch.set(doc(db, "fests", festId, "attendance", id), { ...record, id, markedAt: serverTimestamp() });
  }
  await batch.commit();
}
