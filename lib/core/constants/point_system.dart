/// Configurable rank -> points mapping used when a Result is finalized to
/// increment each winning Group's running total (see ARCHITECTURE.md §5 and
/// DATABASE_SCHEMA.md §2). Kept as a simple class (not hardcoded inline)
/// so an Admin-editable per-fest override can replace [defaultTable] later
/// without touching the scoring logic.
class PointSystem {
  const PointSystem(this.rankToPoints, {this.participationPoints = 1});

  final Map<int, int> rankToPoints;
  final int participationPoints;

  static const PointSystem defaultTable = PointSystem({
    1: 5,
    2: 3,
    3: 1,
  });

  int pointsForRank(int rank) => rankToPoints[rank] ?? participationPoints;
}
