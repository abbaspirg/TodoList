import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/group_repository.dart';
import 'package:madrasa_fest_manager/models/group.dart';
import 'package:madrasa_fest_manager/models/group_total.dart';

class GroupRepositoryFirestore implements GroupRepository {
  GroupRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  @override
  Stream<List<Group>> watchGroups(String festId) {
    return _db
        .collection('fests')
        .doc(festId)
        .collection('groups')
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => Group.fromJson({...d.data(), 'id': d.id}))
            .toList());
  }

  @override
  Future<void> updateGroup(Group group) async {
    await _db
        .collection('fests')
        .doc(group.festId)
        .collection('groups')
        .doc(group.id)
        .update(group.toJson());
  }

  @override
  Stream<List<GroupTotal>> watchGroupTotals(String festId) {
    // Materialized by the `onScoreWrite` / result-finalization Cloud
    // Function (see ARCHITECTURE.md §5) — this repository only reads.
    return _db
        .collection('fests')
        .doc(festId)
        .collection('groupTotals')
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => GroupTotal.fromJson({...d.data(), 'groupId': d.id}))
            .toList());
  }
}
