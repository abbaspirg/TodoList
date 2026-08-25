// Configurable rank/grade -> points mapping, mirrored server-side in
// functions/src/pointSystem.ts (Cloud Functions can't share source with
// the web client). See docs/DATABASE_SCHEMA.md §2.
//
// Grade follows the common Kalolsavam-style fest convention: every
// participant's mark (out of the item's own configurable maxScore — see
// admin-items.js "Maximum score") earns a Grade based on percentage
// achieved, independent of rank, and that grade's points are ADDED to
// whatever rank points a top-3 placement earned. So a participant's total
// points = rank points (0 outside the top 3) + grade points (0 below C).
export const POINT_SYSTEM = {
  rankToPoints: { 1: 5, 2: 3, 3: 1 },
  participationPoints: 1,
  gradeThresholds: [
    { grade: "A", minPercent: 90 },
    { grade: "B", minPercent: 75 },
    { grade: "C", minPercent: 60 },
  ],
  gradeToPoints: { A: 5, B: 3, C: 1 },
};

export function pointsForRank(rank) {
  return POINT_SYSTEM.rankToPoints[rank] ?? POINT_SYSTEM.participationPoints;
}

/** mark and maxScore are the same units (e.g. 8 out of 10) — returns the
 * grade letter ("A"/"B"/"C") or null if below every threshold. */
export function gradeForMark(mark, maxScore) {
  if (!maxScore) return null;
  const percent = (mark / maxScore) * 100;
  for (const { grade, minPercent } of POINT_SYSTEM.gradeThresholds) {
    if (percent >= minPercent) return grade;
  }
  return null;
}

export function pointsForGrade(grade) {
  return grade ? (POINT_SYSTEM.gradeToPoints[grade] ?? 0) : 0;
}
