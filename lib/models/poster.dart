import 'package:freezed_annotation/freezed_annotation.dart';

part 'poster.freezed.dart';
part 'poster.g.dart';

/// One rendered result poster (one per medal position per item). See
/// ARCHITECTURE.md §1 "Poster generation" and DATABASE_SCHEMA.md §1 POSTER.
@freezed
class Poster with _$Poster {
  const factory Poster({
    required String id,
    required String itemId,
    required String itemName,
    required String studentId,
    required String studentName,
    String? studentPhotoUrl,
    required String groupName,
    required String groupColorHex,
    required int rank,
    String? imageUrl,
    DateTime? generatedAt,
  }) = _Poster;

  factory Poster.fromJson(Map<String, dynamic> json) =>
      _$PosterFromJson(json);
}
