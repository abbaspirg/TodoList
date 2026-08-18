/**
 * Server-side mirror of lib/core/constants/point_system.dart — kept in sync
 * manually since Cloud Functions (Node) and the Flutter client (Dart) can't
 * share source. See DATABASE_SCHEMA.md §2.
 */
export interface PointSystem {
  rankToPoints: Record<number, number>;
  participationPoints: number;
}

export const PointSystem = {
  default: {
    rankToPoints: { 1: 5, 2: 3, 3: 1 },
    participationPoints: 1,
  } as PointSystem,
};

export function pointsForRank(system: PointSystem, rank: number): number {
  return system.rankToPoints[rank] ?? system.participationPoints;
}
