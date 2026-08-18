import 'package:freezed_annotation/freezed_annotation.dart';

part 'group.freezed.dart';
part 'group.g.dart';

/// One of the fest's 2 fixed competing groups (e.g. "Green Brigade" vs
/// "Golden Team"). Editable name/color/logo but not created/deleted from the
/// UI — see DATABASE_SCHEMA.md §1 GROUP.
@freezed
class Group with _$Group {
  const factory Group({
    required String id,
    required String festId,
    required String name,
    required String colorHex,
    String? logoUrl,
  }) = _Group;

  factory Group.fromJson(Map<String, dynamic> json) => _$GroupFromJson(json);
}
