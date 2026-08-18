// Local Test Mode data access — same function surface as js/data-firestore.js
// (see docs/DATABASE_SCHEMA.md) but backed by js/local-store.js
// (localStorage) instead of Firestore. Dispatched to from js/data.js
// whenever js/firebase.js isLocalMode() is true. Since local mode is a
// single-device, single-fest sandbox, festId/categoryId-scoping params are
// accepted (for call-signature parity with the Firestore version) but not
// used for partitioning — filtering below only applies the fields actually
// relevant to that query.
import { getAll, get, upsert, remove, subscribe } from "./local-store.js";
import { genId } from "./util.js";
import { pointsForRank } from "./point-system.js";

// --- Groups -----------------------------------------------------------
export function watchGroups(_festId, cb) {
  return subscribe("groups", cb);
}
export function watchGroupTotals(_festId, cb) {
  return subscribe("groupTotals", cb);
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
export async function deleteStudent(_festId, studentId) {
  remove("students", studentId);
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
export async function addJudge(_festId, judge) {
  upsert("judges", { ...judge, id: judge.id || genId(), assignedItemIds: [] });
}
export async function assignJudgeToItems(judgeId, itemIds) {
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
export async function publishResult(_festId, itemId) {
  upsert("results", { itemId, published: true });
}

// --- Result computation (the local equivalent of functions/src/index.ts
// onScoreWrite) -------------------------------------------------------------
function maybeFinalizeItem(itemId) {
  const item = get("items", itemId);
  if (!item) return;
  const assignedJudgeIds = item.assignedJudgeIds || [];
  if (assignedJudgeIds.length === 0) return;

  const registrations = getAll("registrations").filter(
    (r) => r.itemId === itemId && r.status !== "withdrawn",
  );
  if (registrations.length === 0) return;

  const scoresByReg = new Map();
  for (const s of getAll("scores").filter((s) => s.itemId === itemId)) {
    const list = scoresByReg.get(s.registrationId) || [];
    list.push(s.totalMarks);
    scoresByReg.set(s.registrationId, list);
  }

  const allScored = registrations.every(
    (r) => (scoresByReg.get(r.id)?.length ?? 0) >= assignedJudgeIds.length,
  );
  if (!allScored) return;

  const ranked = registrations
    .map((r) => {
      const marks = scoresByReg.get(r.id) || [];
      const totalMarks = marks.reduce((a, b) => a + b, 0) / marks.length;
      return { ...r, totalMarks };
    })
    .sort((a, b) => b.totalMarks - a.totalMarks)
    .map((entry, index) => ({
      registrationId: entry.id,
      studentName: entry.studentName,
      studentPhotoUrl: entry.studentPhotoUrl || null,
      groupId: entry.groupId,
      groupName: entry.groupName,
      rank: index + 1,
      totalMarks: entry.totalMarks,
      points: pointsForRank(index + 1),
    }));

  upsert("results", {
    itemId,
    id: itemId,
    itemName: item.name,
    rankings: ranked,
    finalizedAt: new Date().toISOString(),
    published: false,
  });
  upsert("items", { id: itemId, status: "completed" });

  for (const entry of ranked) {
    const group = get("groups", entry.groupId);
    const existing = get("groupTotals", entry.groupId);
    upsert("groupTotals", {
      id: entry.groupId,
      groupId: entry.groupId,
      groupName: entry.groupName,
      groupColorHex: group?.colorHex || "#999999",
      totalPoints: (existing?.totalPoints || 0) + entry.points,
      updatedAt: new Date().toISOString(),
    });
  }
}
