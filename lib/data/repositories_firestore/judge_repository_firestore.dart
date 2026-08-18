import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:madrasa_fest_manager/data/repositories/judge_repository.dart';
import 'package:madrasa_fest_manager/models/judge.dart';

class JudgeRepositoryFirestore implements JudgeRepository {
  JudgeRepositoryFirestore(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _judges(String festId) =>
      _db.collection('fests').doc(festId).collection('judges');

  @override
  Stream<List<Judge>> watchJudges(String festId) {
    return _judges(festId).snapshots().map((snap) => snap.docs
        .map((d) => Judge.fromJson({...d.data(), 'id': d.id}))
        .toList());
  }

  @override
  Future<void> addJudge(Judge judge) async {
    await _judges(judge.festId).doc(judge.id).set(judge.toJson());
  }

  @override
  Future<void> assignJudgeToItems(String judgeId, List<String> itemIds) async {
    // Server-side: updates the `itemJudges` join docs AND the judge's
    // Firebase Auth custom claims (`assignedItems`) atomically, so security
    // rules immediately reflect the new assignment. See ARCHITECTURE.md §4.
    await _functions.httpsCallable('assignJudgeToItems').call({
      'judgeId': judgeId,
      'itemIds': itemIds,
    });
  }
}
