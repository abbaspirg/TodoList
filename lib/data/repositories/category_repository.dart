import 'package:madrasa_fest_manager/models/category.dart';

abstract class CategoryRepository {
  Stream<List<Category>> watchCategories(String festId);
  Future<void> addCategory(Category category);
  Future<void> updateCategory(Category category);
  Future<void> deleteCategory(String categoryId);
}
