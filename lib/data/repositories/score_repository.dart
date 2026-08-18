import 'package:madrasa_fest_manager/models/score.dart';

abstract class ScoreRepository {
  /// Scores already submitted by [judgeId] for [itemId] — used to grey out
  /// participants a judge has already marked and to detect "all judges
  /// submitted" client-side (authoritative check is server-side).
  Stream<List<Score>> watchScoresByJudge(String itemId, String judgeId);

  /// Submits one participant's marks. Append-only: the Firestore security
  /// rules reject a write if a score document for
  /// (registrationId, judgeId) already exists. See ARCHITECTURE.md §4-5.
  Future<void> submitScore(Score score);
}
