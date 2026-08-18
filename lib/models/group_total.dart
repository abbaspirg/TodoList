import 'package:freezed_annotation/freezed_annotation.dart';

part 'group_total.freezed.dart';
part 'group_total.g.dart';

/// Materialized running total for one [Group], updated transactionally each
/// time a [FestResult] is finalized — read directly by the leaderboard so it
/// stays O(1) regardless of how many items have run. See
/// DATABASE_SCHEMA.md §2.
@freezed
class GroupTotal with _$GroupTotal {
  const factory GroupTotal({
    required String groupId,
    required String groupName,
    required String groupColorHex,
    @Default(0) double totalPoints,
    DateTime? updatedAt,
  }) = _GroupTotal;

  factory GroupTotal.fromJson(Map<String, dynamic> json) =>
      _$GroupTotalFromJson(json);
}
