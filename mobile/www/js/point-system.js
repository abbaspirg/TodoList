// Configurable rank -> points mapping, mirrored server-side in
// functions/src/pointSystem.ts (Cloud Functions can't share source with
// the web client). See docs/DATABASE_SCHEMA.md §2.
export const POINT_SYSTEM = {
  rankToPoints: { 1: 5, 2: 3, 3: 1 },
  participationPoints: 1,
};

export function pointsForRank(rank) {
  return POINT_SYSTEM.rankToPoints[rank] ?? POINT_SYSTEM.participationPoints;
}
