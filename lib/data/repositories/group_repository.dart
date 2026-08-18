import 'package:madrasa_fest_manager/models/group.dart';
import 'package:madrasa_fest_manager/models/group_total.dart';

abstract class GroupRepository {
  Stream<List<Group>> watchGroups(String festId);
  Future<void> updateGroup(Group group);
  Stream<List<GroupTotal>> watchGroupTotals(String festId);
}
