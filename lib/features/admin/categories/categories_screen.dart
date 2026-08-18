import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/models/category.dart';

/// Dynamic category management (Sub-Junior, Junior, Senior, Super Senior,
/// ...) — see UI_UX_WORKFLOW.md §2 "Categories screen".
class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final repo = ref.watch(categoryRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Add Category'),
        onPressed: () => _showForm(context, ref, festId),
      ),
      body: StreamBuilder<List<Category>>(
        stream: repo.watchCategories(festId),
        builder: (context, snapshot) {
          final categories = snapshot.data ?? const [];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (categories.isEmpty) {
            return const Center(
              child: Text('No categories yet. Add "Sub-Junior", "Junior", etc.'),
            );
          }
          return ReorderableListView.builder(
            itemCount: categories.length,
            onReorder: (oldIndex, newIndex) {
              // Persist new sortOrder values via repo.updateCategory in a
              // full implementation.
            },
            itemBuilder: (context, i) {
              final c = categories[i];
              return ListTile(
                key: ValueKey(c.id),
                title: Text(c.name),
                subtitle: Text(
                  c.minAge != null && c.maxAge != null
                      ? 'Ages ${c.minAge}-${c.maxAge}'
                      : 'No age range set',
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => repo.deleteCategory(c.id),
                ),
                onTap: () => _showForm(context, ref, festId, existing: c),
              );
            },
          );
        },
      ),
    );
  }

  void _showForm(BuildContext context, WidgetRef ref, String festId, {Category? existing}) {
    final nameController = TextEditingController(text: existing?.name);
    final minController = TextEditingController(text: existing?.minAge?.toString());
    final maxController = TextEditingController(text: existing?.maxAge?.toString());

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(existing == null ? 'Add Category' : 'Edit Category'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Category name'),
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: minController,
                      decoration: const InputDecoration(labelText: 'Min age'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: maxController,
                      decoration: const InputDecoration(labelText: 'Max age'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) return;
                final repo = ref.read(categoryRepositoryProvider);
                final category = Category(
                  id: existing?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
                  festId: festId,
                  name: nameController.text.trim(),
                  minAge: int.tryParse(minController.text),
                  maxAge: int.tryParse(maxController.text),
                  sortOrder: existing?.sortOrder ?? 0,
                );
                if (existing == null) {
                  await repo.addCategory(category);
                } else {
                  await repo.updateCategory(category);
                }
                if (dialogContext.mounted) Navigator.of(dialogContext).pop();
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }
}
