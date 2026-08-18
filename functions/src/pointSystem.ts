/**
 * Server-side mirror of mobile/www/js/point-system.js — kept in sync
 * manually since Cloud Functions (Node) and the web client can't share
 * source. See DATABASE_SCHEMA.md §2.
 */
export interface GradeThreshold {
  grade: string;
  minPercent: number;
}

export interface PointSystem {
  rankToPoints: Record<number, number>;
  participationPoints: number;
  gradeThresholds: GradeThreshold[];
  gradeToPoints: Record<string, number>;
}

export const PointSystem = {
  default: {
    rankToPoints: { 1: 5, 2: 3, 3: 1 },
    participationPoints: 1,
    gradeThresholds: [
      { grade: "A", minPercent: 90 },
      { grade: "B", minPercent: 75 },
      { grade: "C", minPercent: 60 },
    ],
    gradeToPoints: { A: 5, B: 3, C: 1 },
  } as PointSystem,
};

export function pointsForRank(system: PointSystem, rank: number): number {
  return system.rankToPoints[rank] ?? system.participationPoints;
}

/** mark and maxScore are the same units (e.g. 8 out of 10) — returns the
 * grade letter ("A"/"B"/"C") or null if below every threshold. */
export function gradeForMark(system: PointSystem, mark: number, maxScore: number): string | null {
  if (!maxScore) return null;
  const percent = (mark / maxScore) * 100;
  for (const { grade, minPercent } of system.gradeThresholds) {
    if (percent >= minPercent) return grade;
  }
  return null;
}

export function pointsForGrade(system: PointSystem, grade: string | null): number {
  return grade ? (system.gradeToPoints[grade] ?? 0) : 0;
}
