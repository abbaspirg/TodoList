import 'package:madrasa_fest_manager/models/judge.dart';

abstract class JudgeRepository {
  Stream<List<Judge>> watchJudges(String festId);
  Future<void> addJudge(Judge judge);

  /// Assigns a judge to one or more items and updates their Firebase Auth
  /// custom claims (`assignedItems`) via a Cloud Function so security rules
  /// immediately reflect the new assignment. See ARCHITECTURE.md §4.
  Future<void> assignJudgeToItems(String judgeId, List<String> itemIds);
}
