// Result computation, shared by every backend.
//
// This used to live in three places that had to be kept in sync by hand:
// js/data-local.js (Local Test Mode), functions/src/index.ts (the Cloud
// Function), and functions/src/pointSystem.ts. Cloud Functions require
// Firebase's paid Blaze plan, so the Firestore backend now computes
// results on the client too — which means both backends can finally call
// the same code instead of two copies drifting apart.
import { pointsForRank, gradeForMark, pointsForGrade } from "./point-system.js";

/** True once every registered participant has a mark from every assigned
 * judge — the point at which an item's result can be finalized. */
export function isFullyScored(registrations, marksByRegistrationId, judgeCount) {
  if (judgeCount <= 0 || registrations.length === 0) return false;
  return registrations.every((r) => (marksByRegistrationId.get(r.id)?.length ?? 0) >= judgeCount);
}

/** Averages each participant's marks, ranks them, and assigns grade +
 * points. Returns the `rankings` array stored on a result document —
 * every registrant, not just the top 3, since grade is independent of
 * rank (see docs/DATABASE_SCHEMA.md §2). */
export function computeRankings(registrations, marksByRegistrationId, maxScore) {
  return registrations
    .map((r) => {
      const marks = marksByRegistrationId.get(r.id) ?? [];
      const totalMarks = marks.reduce((a, b) => a + b, 0) / marks.length;
      return { registration: r, totalMarks };
    })
    .sort((a, b) => b.totalMarks - a.totalMarks)
    .map(({ registration, totalMarks }, index) => {
      const rank = index + 1;
      const grade = gradeForMark(totalMarks, maxScore);
      return {
        registrationId: registration.id,
        studentName: registration.studentName,
        studentPhotoUrl: registration.studentPhotoUrl || null,
        groupId: registration.groupId,
        groupName: registration.groupName,
        rank,
        totalMarks,
        maxScore,
        grade,
        // Rank points (1st/2nd/3rd, else a flat participation point) +
        // grade points (0 below a C) — see js/point-system.js for why
        // both are additive.
        points: pointsForRank(rank) + pointsForGrade(grade),
      };
    });
}

/** Group standings, derived from the finalized results rather than kept as
 * a running tally.
 *
 * The previous design incremented a stored total every time an item was
 * finalized, which double-counted if an item was ever re-finalized (a
 * judge resubmitting, or two devices finalizing the same item at once —
 * much more likely now that clients, not a single Cloud Function, do the
 * computing). Deriving is O(results), which is trivial at fest scale, and
 * cannot drift. */
export function computeGroupTotals(results, groups) {
  const totals = new Map(
    groups.map((g) => [g.id, { groupId: g.id, groupName: g.name, groupColorHex: g.colorHex, totalPoints: 0 }]),
  );
  for (const result of results) {
    for (const entry of result.rankings || []) {
      let row = totals.get(entry.groupId);
      if (!row) {
        // A group deleted after its students competed still has points on
        // record — keep them visible rather than silently dropping them.
        row = { groupId: entry.groupId, groupName: entry.groupName, groupColorHex: "#999999", totalPoints: 0 };
        totals.set(entry.groupId, row);
      }
      row.totalPoints += entry.points || 0;
    }
  }
  return [...totals.values()];
}
