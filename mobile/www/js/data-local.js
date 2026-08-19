// Local Test Mode data access — same function surface as js/data-firestore.js
// (see docs/DATABASE_SCHEMA.md) but backed by js/local-store.js
// (localStorage) instead of Firestore. Dispatched to from js/data.js
// whenever js/firebase.js isLocalMode() is true. Since local mode is a
// single-device, single-fest sandbox, festId/categoryId-scoping params are
// accepted (for call-signature parity with the Firestore version) but not
// used for partitioning — filtering below only applies the fields actually
// relevant to that query.
import { getAll, get, upsert, remove, subscribe, subscribeSettings, updateSettings } from "./local-store.js";
import { genId } from "./util.js";
import { computeRankings, computeGroupTotals, isFullyScored } from "./scoring.js";

// --- Fest settings (Madrasa name, shown on posters) ------------------------
export function watchFestSettings(_festId, cb) {
  return subscribeSettings(cb);
}
export async function updateFestSettings(_festId, settings) {
  updateSettings(settings);
}

// --- Groups -----------------------------------------------------------
export function watchGroups(_festId, cb) {
  return subscribe("groups", cb);
}
// Derived from results rather than read from a stored running tally — see
// js/scoring.js computeGroupTotals for why. Published results only, so
// standings don't reveal an item's outcome before it's announced (and to
// match the Firestore backend, where guests may only read published ones).
export function watchGroupTotals(_festId, cb) {
  const emit = () =>
    cb(computeGroupTotals(getAll("results").filter((r) => r.published), getAll("groups")));
  const unsubResults = subscribe("results", emit);
  const unsubGroups = subscribe("groups", emit);
  return () => {
    unsubResults();
    unsubGroups();
  };
}
export async function addGroup(_festId, group) {
  upsert("groups", { ...group, id: group.id || genId() });
}
export async function updateGroup(_festId, group) {
  upsert("groups", group);
}
export async function deleteGroup(_festId, groupId) {
  remove("groups", groupId);
}

// --- Categories ---------------------------------------------------------
export function watchCategories(_festId, cb) {
  return subscribe("categories", (list) => cb([...list].sort((a, b) => a.sortOrder - b.sortOrder)));
}
export async function addCategory(_festId, category) {
  upsert("categories", { ...category, id: category.id || genId() });
}
export async function updateCategory(_festId, category) {
  upsert("categories", category);
}
export async function deleteCategory(_festId, categoryId) {
  remove("categories", categoryId);
}

// --- Students -------------------------------------------------------------
export function watchStudents(_festId, groupId, cb) {
  return subscribe("students", (list) => cb(groupId ? list.filter((s) => s.groupId === groupId) : list));
}
export async function addStudent(_festId, student) {
  upsert("students", { ...student, id: student.id || genId(), createdAt: new Date().toISOString() });
}
export async function updateStudent(_festId, student) {
  upsert("students", student);
}
// Cascades match the Firestore backend — see its deleteStudent for why
// registrations and scores go with the student.
export async function deleteStudent(_festId, studentId) {
  remove("students", studentId);
  const regIds = getAll("registrations")
    .filter((r) => r.studentId === studentId)
    .map((r) => r.id);
  for (const id of regIds) remove("registrations", id);
  for (const s of getAll("scores").filter((s) => regIds.includes(s.registrationId))) {
    remove("scores", s.id);
  }
}
export async function uploadStudentPhoto(_festId, _studentId, canvas) {
  // No Storage backend locally — the resized photo is stored inline as a
  // data URL. Fine at the small size util.js's resizeImageFile produces;
  // not meant for hundreds of students (localStorage has a ~5-10MB quota).
  return canvas.toDataURL("image/jpeg", 0.82);
}

// --- Items ------------------------------------------------------------------
export function watchItems(_festId, categoryId, cb) {
  return subscribe("items", (list) => cb(categoryId ? list.filter((i) => i.categoryId === categoryId) : list));
}
export function watchItem(_festId, itemId, cb) {
  return subscribe("items", (list) => cb(list.find((i) => i.id === itemId) ?? null));
}
export async function addItem(_festId, item) {
  upsert("items", { ...item, id: item.id || genId(), status: "pending", assignedJudgeIds: [] });
}
export async function updateItem(_festId, item) {
  upsert("items", item);
}
export async function setItemStatus(_festId, itemId, status) {
  upsert("items", { id: itemId, status });
}
export async function deleteItem(_festId, itemId) {
  remove("items", itemId);
  remove("results", itemId);
  for (const r of getAll("registrations").filter((r) => r.itemId === itemId)) remove("registrations", r.id);
  for (const s of getAll("scores").filter((s) => s.itemId === itemId)) remove("scores", s.id);
}

// --- Registrations ------------------------------------------------------
export function watchRegistrations(itemId, cb) {
  return subscribe("registrations", (list) => cb(list.filter((r) => r.itemId === itemId)));
}
export async function registerStudent(registration) {
  const id = registration.id || `${registration.itemId}_${registration.studentId}`;
  upsert("registrations", { ...registration, id, status: "registered" });
}
export async function withdrawRegistration(registrationId) {
  upsert("registrations", { id: registrationId, status: "withdrawn" });
}

// --- Judges -------------------------------------------------------------
export function watchJudges(_festId, cb) {
  return subscribe("judges", cb);
}
export function watchJudge(_festId, judgeId, cb) {
  return subscribe("judges", (list) => cb(list.find((j) => j.id === judgeId) ?? null));
}
export async function addJudge(_festId, judge) {
  upsert("judges", { ...judge, id: judge.id || genId(), assignedItemIds: [] });
}
/** No-op locally: Local Test Mode has no accounts — a judge "signs in" by
 * picking their name from the list on the login screen (js/auth-local.js). */
export async function setUserRole() {}

export async function deleteJudge(_festId, judgeId) {
  remove("judges", judgeId);
  // Drop them from every item they were assigned to, so an item left
  // waiting only on this judge can still be finalized. Their submitted
  // scores are kept — see the Firestore version for why.
  for (const item of getAll("items")) {
    const assigned = item.assignedJudgeIds || [];
    if (!assigned.includes(judgeId)) continue;
    upsert("items", { id: item.id, assignedJudgeIds: assigned.filter((id) => id !== judgeId) });
  }
}
export async function assignJudgeToItems(_festId, judgeId, itemIds) {
  // No Cloud Function / custom claims needed locally — the judge doc's
  // assignedItemIds *is* the authorization check in Local Test Mode (see
  // js/auth-local.js, which signs in "as" a specific judge id directly).
  const judge = get("judges", judgeId);
  if (judge) upsert("judges", { ...judge, assignedItemIds: itemIds });
  for (const item of getAll("items")) {
    const assigned = new Set(item.assignedJudgeIds || []);
    const shouldHave = itemIds.includes(item.id);
    if (shouldHave && !assigned.has(judgeId)) {
      upsert("items", { id: item.id, assignedJudgeIds: [...assigned, judgeId] });
    } else if (!shouldHave && assigned.has(judgeId)) {
      assigned.delete(judgeId);
      upsert("items", { id: item.id, assignedJudgeIds: [...assigned] });
    }
  }
}

// --- Scores -----------------------------------------------------------------
export function watchScoresByJudge(itemId, judgeId, cb) {
  return subscribe("scores", (list) =>
    cb(list.filter((s) => s.itemId === itemId && s.judgeId === judgeId)),
  );
}
export async function submitScore(score) {
  const id = `${score.registrationId}_${score.judgeId}`;
  upsert("scores", { ...score, id, submittedAt: new Date().toISOString() });
  maybeFinalizeItem(score.itemId);
}

// --- Results ----------------------------------------------------------------
export function watchPublishedResults(_festId, cb) {
  return subscribe("results", (list) =>
    cb(
      list
        .filter((r) => r.published)
        .sort((a, b) => new Date(b.finalizedAt) - new Date(a.finalizedAt)),
    ),
  );
}
export function watchAllResults(_festId, cb) {
  return subscribe("results", cb);
}
/** Parity with the Firestore backend, where a judge's device can fail to
 * write the result after its mark lands. Can't happen locally (one device,
 * no rules), but Admin > Results calls it either way. */
export async function finalizePendingItems(_festId) {
  let finalized = 0;
  for (const item of getAll("items")) {
    if (item.status === "completed") continue;
    if (maybeFinalizeItem(item.id)) finalized++;
  }
  return finalized;
}

export async function unpublishResult(_festId, itemId) {
  upsert("results", { id: itemId, itemId, published: false });
}

// --- Admin overrides (see data-firestore.js for the rationale) --------------
export function watchItemScores(itemId, cb) {
  return subscribe("scores", (list) => cb(list.filter((sc) => sc.itemId === itemId)));
}
export async function overrideScore(_festId, scoreId, totalMarks, itemId) {
  upsert("scores", { id: scoreId, totalMarks, editedByAdminAt: new Date().toISOString() });
  recomputeResult(itemId);
}
export async function recomputeItemResult(_festId, itemId) {
  return recomputeResult(itemId);
}

export async function publishResult(_festId, itemId) {
  // local-store's upsert() matches existing docs by `id`, not `itemId` —
  // maybeFinalizeItem() below sets both to the same value, so this must
  // too or it silently creates a second, empty result doc instead of
  // publishing the real one (that was a real, shipped bug).
  upsert("results", { id: itemId, itemId, published: true });
}

// --- Result computation -----------------------------------------------------
// Ranking/grading itself lives in js/scoring.js, shared with the Firestore
// backend; this just gathers the inputs from the local store.
/** Local mirror of data-firestore.js recomputeResult — same semantics, so
 * Local Test Mode behaves like the real thing. See there for why
 * `onlyIfComplete` exists. Group totals are derived on read
 * (watchGroupTotals), so there is no running tally to adjust here. */
function recomputeResult(itemId, { onlyIfComplete = false } = {}) {
  const item = get("items", itemId);
  if (!item) return false;
  const assignedJudgeIds = item.assignedJudgeIds || [];

  const registrations = getAll("registrations").filter(
    (r) => r.itemId === itemId && r.status !== "withdrawn",
  );
  const scoresByReg = new Map();
  for (const sc of getAll("scores").filter((sc) => sc.itemId === itemId)) {
    const list = scoresByReg.get(sc.registrationId) || [];
    list.push(sc.totalMarks);
    scoresByReg.set(sc.registrationId, list);
  }

  const complete =
    assignedJudgeIds.length > 0 &&
    registrations.length > 0 &&
    isFullyScored(registrations, scoresByReg, assignedJudgeIds.length);

  if (!complete) {
    if (onlyIfComplete) return false;
    if (get("results", itemId)) remove("results", itemId);
    if (item.status === "completed") upsert("items", { id: itemId, status: "ongoing" });
    return false;
  }

  const ranked = computeRankings(registrations, scoresByReg, item.maxScore || 10);
  const existing = get("results", itemId);
  upsert("results", {
    itemId,
    id: itemId,
    itemName: item.name,
    rankings: ranked,
    finalizedAt: new Date().toISOString(),
    published: Boolean(existing?.published),
  });
  upsert("items", { id: itemId, status: "completed" });
  return true;
}

function maybeFinalizeItem(itemId) {
  return recomputeResult(itemId, { onlyIfComplete: true });
}

// --- Attendance (see data-firestore.js for the record shape) ---------------
export function watchAttendance(_festId, date, cb) {
  return subscribe("attendance", (list) => cb(list.filter((a) => a.date === date)));
}
export async function setAttendance(_festId, record) {
  upsert("attendance", { ...record, id: `${record.date}_${record.studentId}`, markedAt: new Date().toISOString() });
}
export async function setAttendanceBulk(_festId, records) {
  for (const record of records) await setAttendance(_festId, record);
}
