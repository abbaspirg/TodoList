import 'package:freezed_annotation/freezed_annotation.dart';

part 'result.freezed.dart';
part 'result.g.dart';

/// One ranking entry within a [Result.rankings] list.
@freezed
class RankingEntry with _$RankingEntry {
  const factory RankingEntry({
    required String registrationId,
    required String studentName,
    String? studentPhotoUrl,
    required String groupId,
    required String groupName,
    required int rank,
    required double totalMarks,
    required int points,
  }) = _RankingEntry;

  factory RankingEntry.fromJson(Map<String, dynamic> json) =>
      _$RankingEntryFromJson(json);
}

/// The finalized outcome of one [Item], written once by the result-
/// computation Cloud Function when every assigned judge has submitted (or
/// an Admin force-finalizes). See ARCHITECTURE.md §5.
@freezed
class FestResult with _$FestResult {
  const factory FestResult({
    required String itemId,
    required String itemName,
    required List<RankingEntry> rankings,
    DateTime? finalizedAt,
    @Default(false) bool published,
  }) = _FestResult;

  factory FestResult.fromJson(Map<String, dynamic> json) =>
      _$FestResultFromJson(json);
}
