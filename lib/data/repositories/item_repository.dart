import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/models/item.dart';

abstract class ItemRepository {
  Stream<List<Item>> watchItems(String festId, {String? categoryId});
  Stream<Item?> watchItem(String itemId);
  Future<void> addItem(Item item);
  Future<void> updateItem(Item item);
  Future<void> deleteItem(String itemId);

  /// Flips the item's status — e.g. Admin taps "Open for Scoring" to move
  /// `pending -> ongoing`, which is what the Judge Panel streams react to.
  Future<void> setItemStatus(String itemId, ItemStatus status);
}
