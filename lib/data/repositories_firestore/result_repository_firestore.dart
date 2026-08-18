import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/result_repository.dart';
import 'package:madrasa_fest_manager/models/result.dart';

class ResultRepositoryFirestore implements ResultRepository {
  ResultRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _results(String festId) =>
      _db.collection('fests').doc(festId).collection('results');

  @override
  Stream<List<FestResult>> watchPublishedResults(String festId) {
    return _results(festId)
        .where('published', isEqualTo: true)
        .orderBy('finalizedAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => FestResult.fromJson({...d.data(), 'itemId': d.id}))
            .toList());
  }

  @override
  Stream<FestResult?> watchResult(String itemId) {
    return _db.collectionGroup('results').snapshots().map((snap) {
      final match = snap.docs.where((d) => d.id == itemId);
      if (match.isEmpty) return null;
      final d = match.first;
      return FestResult.fromJson({...d.data(), 'itemId': d.id});
    });
  }

  @override
  Future<void> publishResult(String itemId) async {
    final snap = await _db
        .collectionGroup('results')
        .where(FieldPath.documentId, isEqualTo: itemId)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return;
    await snap.docs.first.reference.update({'published': true});
  }
}
