import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/category_repository.dart';
import 'package:madrasa_fest_manager/models/category.dart';

class CategoryRepositoryFirestore implements CategoryRepository {
  CategoryRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _categories(String festId) =>
      _db.collection('fests').doc(festId).collection('categories');

  @override
  Stream<List<Category>> watchCategories(String festId) {
    return _categories(festId).orderBy('sortOrder').snapshots().map(
          (snap) => snap.docs
              .map((d) => Category.fromJson({...d.data(), 'id': d.id}))
              .toList(),
        );
  }

  @override
  Future<void> addCategory(Category category) async {
    await _categories(category.festId).doc(category.id).set(category.toJson());
  }

  @override
  Future<void> updateCategory(Category category) async {
    await _categories(category.festId)
        .doc(category.id)
        .update(category.toJson());
  }

  @override
  Future<void> deleteCategory(String categoryId) async {
    final snap = await _db
        .collectionGroup('categories')
        .where(FieldPath.documentId, isEqualTo: categoryId)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return;
    await snap.docs.first.reference.delete();
  }
}
