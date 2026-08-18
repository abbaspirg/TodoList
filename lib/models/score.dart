import 'package:freezed_annotation/freezed_annotation.dart';

part 'score.freezed.dart';
part 'score.g.dart';

/// One judge's marks for one participant in one item. Append-only once
/// written — see ARCHITECTURE.md §4 (a judge cannot update/delete a
/// submitted score; corrections go through an Admin-only audit trail).
@freezed
class Score with _$Score {
  const factory Score({
    required String id,
    required String itemId,
    required String registrationId,
    required String judgeId,
    required Map<String, num> criteriaMarks,
    required double totalMarks,
    DateTime? submittedAt,
  }) = _Score;

  factory Score.fromJson(Map<String, dynamic> json) => _$ScoreFromJson(json);
}
