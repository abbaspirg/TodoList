import 'package:freezed_annotation/freezed_annotation.dart';

part 'category.freezed.dart';
part 'category.g.dart';

/// Dynamic, admin-managed age category (Sub-Junior, Junior, Senior, Super
/// Senior, ...). See DATABASE_SCHEMA.md §1 CATEGORY.
@freezed
class Category with _$Category {
  const factory Category({
    required String id,
    required String festId,
    required String name,
    int? minAge,
    int? maxAge,
    @Default(0) int sortOrder,
  }) = _Category;

  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);
}
