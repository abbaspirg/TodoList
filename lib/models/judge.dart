import 'package:freezed_annotation/freezed_annotation.dart';

part 'judge.freezed.dart';
part 'judge.g.dart';

@freezed
class Judge with _$Judge {
  const factory Judge({
    required String id,
    required String festId,
    required String name,
    String? email,
    String? phone,
    String? authUid,
    @Default(<String>[]) List<String> assignedItemIds,
  }) = _Judge;

  factory Judge.fromJson(Map<String, dynamic> json) => _$JudgeFromJson(json);
}
