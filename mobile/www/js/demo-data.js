// One-tap demo fest for Local Test Mode — populates a realistic, fully
// scored fest so every screen (registrations, judging, results, grades,
// leaderboard, posters) has something to show without typing it all in by
// hand. Deliberately drives the *real* js/data-local.js write path rather
// than stuffing pre-baked documents into localStorage: scores go through
// submitScore(), so results, grades, points and group totals are computed
// by the same code the app uses in anger. That keeps this file honest —
// if the scoring logic changes, the demo data changes with it.
//
// Local Test Mode only (js/firebase.js isLocalMode()); it imports
// js/data-local.js directly for that reason.
import { FEST_ID } from "./app-config.js";
import { resetLocalData } from "./local-store.js";
import {
  addGroup,
  addCategory,
  addStudent,
  addItem,
  addJudge,
  assignJudgeToItems,
  registerStudent,
  submitScore,
  publishResult,
  setItemStatus,
  updateFestSettings,
} from "./data-local.js";

const MADRASA_NAME = "Darul Uloom Islamic Academy";

// group-a / group-b already exist from local-store.js seedDefaults(); a
// third is added here so the app's multi-group support is visible.
const GROUPS = [
  { id: "group-a", name: "Green Brigade", colorHex: "#0f6e4f", seeded: true },
  { id: "group-b", name: "Golden Team", colorHex: "#c9971f", seeded: true },
  { id: "group-c", name: "Blue Falcons", colorHex: "#2f6fed", seeded: false },
];

const CATEGORIES = [
  { id: "cat-sub", name: "Sub Junior", sortOrder: 1 },
  { id: "cat-jun", name: "Junior", sortOrder: 2 },
  { id: "cat-sen", name: "Senior", sortOrder: 3 },
];

// `photo: true` gets a generated avatar (see makeAvatar) so posters have
// real images to lay out; the rest exercise the initials fallback.
const STUDENTS = [
  { id: "stu-01", name: "Muhammed Ashraf", groupId: "group-a", categoryId: "cat-sub", className: "Class 3", photo: true },
  { id: "stu-02", name: "Fathima Zahra", groupId: "group-b", categoryId: "cat-sub", className: "Class 3", photo: true },
  { id: "stu-03", name: "Ibrahim Sadiq", groupId: "group-a", categoryId: "cat-sub", className: "Class 4" },
  { id: "stu-04", name: "Ayisha Nasrin", groupId: "group-c", categoryId: "cat-sub", className: "Class 4" },
  { id: "stu-05", name: "Yusuf Hameed", groupId: "group-b", categoryId: "cat-sub", className: "Class 3" },

  { id: "stu-06", name: "Abdul Rahman", groupId: "group-a", categoryId: "cat-jun", className: "Class 6", photo: true },
  { id: "stu-07", name: "Khadeeja Mariyam", groupId: "group-b", categoryId: "cat-jun", className: "Class 6", photo: true },
  { id: "stu-08", name: "Zainab Noor", groupId: "group-c", categoryId: "cat-jun", className: "Class 5" },
  { id: "stu-09", name: "Hamza Faisal", groupId: "group-a", categoryId: "cat-jun", className: "Class 5" },
  { id: "stu-10", name: "Safwan Ali", groupId: "group-b", categoryId: "cat-jun", className: "Class 6" },

  { id: "stu-11", name: "Bilal Ahmed", groupId: "group-a", categoryId: "cat-sen", className: "Class 9", photo: true },
  { id: "stu-12", name: "Ruqayya Banu", groupId: "group-b", categoryId: "cat-sen", className: "Class 8", photo: true },
  { id: "stu-13", name: "Umar Farooq", groupId: "group-c", categoryId: "cat-sen", className: "Class 9" },
  { id: "stu-14", name: "Aminah Siddiqa", groupId: "group-a", categoryId: "cat-sen", className: "Class 8" },
  { id: "stu-15", name: "Salman Rashid", groupId: "group-c", categoryId: "cat-sen", className: "Class 9" },
];

const JUDGES = [
  { id: "judge-1", name: "Ustad Abdul Rahman", email: "rahman@example.com" },
  { id: "judge-2", name: "Ustad Kareem Faizy", email: "kareem@example.com" },
  { id: "judge-3", name: "Ustad Salim Musliyar", email: "salim@example.com" },
];

// Each item lists the students competing and the *base* mark each should
// average around. Judges vary from that base by JUDGE_OFFSETS below, so
// averages land on clean halves and produce a deliberate spread of grades
// (A ≥90%, B ≥75%, C ≥60%, none below) — see js/point-system.js.
//
// `state` drives how far each item is taken:
//   published   — fully scored, result computed, visible to the public
//   unpublished — fully scored, awaiting the admin's Publish tap
//   ongoing     — open for scoring, only some judges have submitted
//   pending     — registered but not yet opened for scoring
const ITEMS = [
  {
    id: "item-qirath",
    name: "Qirath",
    categoryId: "cat-sub",
    type: "individual",
    maxScore: 10,
    judgeIds: ["judge-1", "judge-2"],
    state: "published",
    entries: [
      { studentId: "stu-01", base: 10 },
      { studentId: "stu-02", base: 9 },
      { studentId: "stu-03", base: 7 },
      { studentId: "stu-04", base: 5 },
    ],
  },
  {
    id: "item-hamd",
    name: "Hamd & Naat",
    categoryId: "cat-jun",
    type: "individual",
    maxScore: 10,
    judgeIds: ["judge-1", "judge-2"],
    state: "published",
    entries: [
      { studentId: "stu-07", base: 10 },
      { studentId: "stu-06", base: 9 },
      { studentId: "stu-08", base: 8 },
      { studentId: "stu-09", base: 7 },
      { studentId: "stu-10", base: 6 },
    ],
  },
  {
    id: "item-quiz",
    name: "Islamic Quiz",
    categoryId: "cat-sen",
    type: "individual",
    maxScore: 15,
    judgeIds: ["judge-2", "judge-3"],
    state: "published",
    entries: [
      { studentId: "stu-13", base: 15 },
      { studentId: "stu-11", base: 13 },
      { studentId: "stu-12", base: 11 },
      { studentId: "stu-14", base: 9 },
      { studentId: "stu-15", base: 7 },
    ],
  },
  {
    // A group item scored out of 20 rather than 10 — the case the
    // configurable maxScore exists for. Left unpublished so the admin's
    // Publish flow has something to act on.
    id: "item-mappila",
    name: "Group Mappila Paattu",
    categoryId: "cat-jun",
    type: "group",
    maxScore: 20,
    judgeIds: ["judge-1", "judge-2"],
    state: "unpublished",
    entries: [
      { studentId: "stu-06", base: 19 },
      { studentId: "stu-10", base: 17 },
      { studentId: "stu-07", base: 15 },
      { studentId: "stu-08", base: 12 },
    ],
  },
  {
    // Only the first assigned judge has submitted, so the result stays
    // uncomputed — sign in as Ustad Salim Musliyar to finish scoring it
    // and watch the result and leaderboard update live.
    id: "item-speech",
    name: "Speech (Malayalam)",
    categoryId: "cat-sen",
    type: "individual",
    maxScore: 10,
    judgeIds: ["judge-2", "judge-3"],
    state: "ongoing",
    entries: [
      { studentId: "stu-11", base: 9 },
      { studentId: "stu-12", base: 8 },
      { studentId: "stu-14", base: 7 },
      { studentId: "stu-15", base: 6 },
    ],
  },
  {
    id: "item-calligraphy",
    name: "Arabic Calligraphy",
    categoryId: "cat-sub",
    type: "individual",
    maxScore: 10,
    judgeIds: ["judge-1"],
    state: "pending",
    entries: [
      { studentId: "stu-02", base: 8 },
      { studentId: "stu-04", base: 7 },
      { studentId: "stu-05", base: 6 },
    ],
  },
];

// Judges rarely agree exactly; a small deterministic spread keeps the
// averages realistic (and lands them on clean .5 values).
const JUDGE_OFFSETS = [0, -1, 1];

/** Small round avatar (group colour + initial) as a data URL. Real photos
 * would come from an upload; these just give the poster layouts something
 * to render without shipping image files. */
function makeAvatar(name, colorHex) {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `bold ${Math.round(size * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name || "?").trim().charAt(0).toUpperCase(), size / 2, size / 2 + 2);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function clampMark(mark, maxScore) {
  return Math.max(0, Math.min(maxScore, mark));
}

/** Wipes local data and rebuilds the demo fest. Returns a short summary
 * the caller can surface. */
export async function loadDemoData() {
  resetLocalData();

  await updateFestSettings(FEST_ID, { madrasaName: MADRASA_NAME });

  const groupById = new Map(GROUPS.map((g) => [g.id, g]));
  for (const group of GROUPS) {
    if (group.seeded) continue; // already present from seedDefaults()
    await addGroup(FEST_ID, { id: group.id, festId: FEST_ID, name: group.name, colorHex: group.colorHex });
  }

  for (const category of CATEGORIES) {
    await addCategory(FEST_ID, { ...category, festId: FEST_ID });
  }

  const studentById = new Map();
  for (const s of STUDENTS) {
    const group = groupById.get(s.groupId);
    const student = {
      id: s.id,
      festId: FEST_ID,
      name: s.name,
      className: s.className,
      groupId: s.groupId,
      categoryId: s.categoryId,
      photoUrl: s.photo ? makeAvatar(s.name, group.colorHex) : null,
    };
    studentById.set(s.id, student);
    await addStudent(FEST_ID, student);
  }

  for (const item of ITEMS) {
    await addItem(FEST_ID, {
      id: item.id,
      festId: FEST_ID,
      name: item.name,
      categoryId: item.categoryId,
      type: item.type,
      maxScore: item.maxScore,
    });
  }

  for (const judge of JUDGES) {
    await addJudge(FEST_ID, { ...judge, festId: FEST_ID });
    const assigned = ITEMS.filter((i) => i.judgeIds.includes(judge.id)).map((i) => i.id);
    await assignJudgeToItems(FEST_ID, judge.id, assigned);
  }

  for (const item of ITEMS) {
    for (const [index, entry] of item.entries.entries()) {
      const student = studentById.get(entry.studentId);
      const group = groupById.get(student.groupId);
      await registerStudent({
        itemId: item.id,
        studentId: student.id,
        studentName: student.name,
        studentPhotoUrl: student.photoUrl,
        groupId: student.groupId,
        groupName: group.name,
        groupColorHex: group.colorHex,
        chestNumber: String(index + 1),
      });
    }
  }

  // Scores last: submitScore() finalizes an item (computing ranks, grades,
  // points and group totals) as soon as every assigned judge has scored
  // every participant, so everything above must already be in place.
  for (const item of ITEMS) {
    if (item.state === "pending") continue;
    // An "ongoing" item deliberately gets only its first judge's marks, so
    // it stays unfinalized and remains scoreable in the Judge Panel.
    const judgeIds = item.state === "ongoing" ? item.judgeIds.slice(0, 1) : item.judgeIds;

    for (const [judgeIndex, judgeId] of judgeIds.entries()) {
      for (const entry of item.entries) {
        await submitScore({
          festId: FEST_ID,
          itemId: item.id,
          registrationId: `${item.id}_${entry.studentId}`,
          judgeId,
          totalMarks: clampMark(entry.base + JUDGE_OFFSETS[judgeIndex % JUDGE_OFFSETS.length], item.maxScore),
          maxScore: item.maxScore,
        });
      }
    }
  }

  // Finalizing marks an item "completed" by itself, and addItem() already
  // leaves the untouched one "pending" — only the half-scored item needs
  // its status set explicitly so it shows up in the Judge Panel queue.
  for (const item of ITEMS) {
    if (item.state === "ongoing") await setItemStatus(FEST_ID, item.id, "ongoing");
  }

  for (const item of ITEMS) {
    if (item.state === "published") await publishResult(FEST_ID, item.id);
  }

  return {
    groups: GROUPS.length,
    categories: CATEGORIES.length,
    students: STUDENTS.length,
    items: ITEMS.length,
    judges: JUDGES.length,
  };
}
