import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/score_repository.dart';
import 'package:madrasa_fest_manager/models/score.dart';

class ScoreRepositoryFirestore implements ScoreRepository {
  ScoreRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  @override
  Stream<List<Score>> watchScoresByJudge(String itemId, String judgeId) {
    return _db
        .collectionGroup('scores')
        .where('itemId', isEqualTo: itemId)
        .where('judgeId', isEqualTo: judgeId)
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => Score.fromJson({...d.data(), 'id': d.id}))
            .toList());
  }

  @override
  Future<void> submitScore(Score score) async {
    // Firestore security rules enforce: create-only (no update/delete), and
    // only when request.auth.uid == score.judgeId and the item is
    // `ongoing` and in the judge's assignedItems claim. See
    // ARCHITECTURE.md §4-5. Using the deterministic doc ID
    // `{registrationId}_{judgeId}` also gives idempotent double-submit
    // protection for free.
    final docId = '${score.registrationId}_${score.judgeId}';
    await _db.collection('scores').doc(docId).set({
      ...score.toJson(),
      'id': docId,
      'submittedAt': FieldValue.serverTimestamp(),
    });
  }
}
