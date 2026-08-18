import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/data/repositories/item_repository.dart';
import 'package:madrasa_fest_manager/models/item.dart';

class ItemRepositoryFirestore implements ItemRepository {
  ItemRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _items(String festId) =>
      _db.collection('fests').doc(festId).collection('items');

  @override
  Stream<List<Item>> watchItems(String festId, {String? categoryId}) {
    Query<Map<String, dynamic>> query = _items(festId);
    if (categoryId != null) {
      query = query.where('categoryId', isEqualTo: categoryId);
    }
    return query.orderBy('scheduledAt').snapshots().map(
          (snap) => snap.docs
              .map((d) => Item.fromJson({...d.data(), 'id': d.id}))
              .toList(),
        );
  }

  @override
  Stream<Item?> watchItem(String itemId) {
    return _db.collectionGroup('items').snapshots().map((snap) {
      final match = snap.docs.where((d) => d.id == itemId);
      if (match.isEmpty) return null;
      final d = match.first;
      return Item.fromJson({...d.data(), 'id': d.id});
    });
  }

  @override
  Future<void> addItem(Item item) async {
    await _items(item.festId).doc(item.id).set(item.toJson());
  }

  @override
  Future<void> updateItem(Item item) async {
    await _items(item.festId).doc(item.id).update(item.toJson());
  }

  @override
  Future<void> deleteItem(String itemId) async {
    // Item docs are looked up via collection group since festId isn't known
    // by the caller in every deletion flow (e.g. a swipe-to-delete row).
    final snap = await _db
        .collectionGroup('items')
        .where(FieldPath.documentId, isEqualTo: itemId)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return;
    await snap.docs.first.reference.delete();
  }

  @override
  Future<void> setItemStatus(String itemId, ItemStatus status) async {
    final snap = await _db
        .collectionGroup('items')
        .where(FieldPath.documentId, isEqualTo: itemId)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return;
    await snap.docs.first.reference.update({'status': status.name});
  }
}
