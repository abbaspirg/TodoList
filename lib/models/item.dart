import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';

part 'item.freezed.dart';
part 'item.g.dart';

/// A competition item/event mapped to a [Category], e.g. "Qasida Recitation"
/// under "Junior". See DATABASE_SCHEMA.md §1 ITEM.
@freezed
class Item with _$Item {
  const factory Item({
    required String id,
    required String festId,
    required String categoryId,
    required String name,
    @Default(ItemType.individual) ItemType type,
    @Default(StageType.stage) StageType stageType,
    @Default(1) int maxParticipantsPerGroup,
    @Default(ItemScoringCriteria.defaultCriteria)
        List<String> scoringCriteria,
    @Default(ItemStatus.pending) ItemStatus status,
    DateTime? scheduledAt,
  }) = _Item;

  factory Item.fromJson(Map<String, dynamic> json) => _$ItemFromJson(json);
}

/// Default marking criteria shown on the Judge scoring screen when an item
/// doesn't define its own — see UI_UX_WORKFLOW.md §3.
class ItemScoringCriteria {
  static const List<String> defaultCriteria = [
    'Voice',
    'Pronunciation',
    'Presentation',
  ];
}
