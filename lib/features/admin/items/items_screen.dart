import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/models/category.dart';
import 'package:madrasa_fest_manager/models/item.dart';

/// Items grouped by category with a status chip and the "Open for Scoring"
/// action that flips `status -> ongoing`, pushing the item live to judges.
/// See UI_UX_WORKFLOW.md §2 "Items screen".
class ItemsScreen extends ConsumerWidget {
  const ItemsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final itemRepo = ref.watch(itemRepositoryProvider);
    final categoryRepo = ref.watch(categoryRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Items')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Add Item'),
        onPressed: () => _showForm(context, ref, festId),
      ),
      body: StreamBuilder<List<Category>>(
        stream: categoryRepo.watchCategories(festId),
        builder: (context, categorySnap) {
          final categories = {for (final c in categorySnap.data ?? []) c.id: c};
          return StreamBuilder<List<Item>>(
            stream: itemRepo.watchItems(festId),
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final items = snapshot.data!;
              if (items.isEmpty) {
                return const Center(
                  child: Text('Add your first competition item.'),
                );
              }
              return ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final item = items[i];
                  final categoryName = categories[item.categoryId]?.name ?? 'Uncategorized';
                  return ListTile(
                    title: Text(item.name),
                    subtitle: Text('$categoryName · ${item.type.label}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Chip(label: Text(item.status.label)),
                        if (item.status == ItemStatus.pending)
                          IconButton(
                            icon: const Icon(Icons.play_circle_outline),
                            tooltip: 'Open for scoring',
                            onPressed: () =>
                                itemRepo.setItemStatus(item.id, ItemStatus.ongoing),
                          ),
                      ],
                    ),
                    onTap: () => _showForm(context, ref, festId, existing: item),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  void _showForm(BuildContext context, WidgetRef ref, String festId, {Item? existing}) {
    final nameController = TextEditingController(text: existing?.name);
    String? categoryId = existing?.categoryId;
    var type = existing?.type ?? ItemType.individual;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 16,
          ),
          child: StreamBuilder<List<Category>>(
            stream: ref.read(categoryRepositoryProvider).watchCategories(festId),
            builder: (context, snapshot) {
              final categories = snapshot.data ?? const [];
              return StatefulBuilder(
                builder: (context, setSheetState) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(existing == null ? 'Add Item' : 'Edit Item',
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      TextField(
                        controller: nameController,
                        decoration: const InputDecoration(labelText: 'Item name'),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: categoryId,
                        decoration: const InputDecoration(labelText: 'Category'),
                        items: categories
                            .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                            .toList(),
                        onChanged: (v) => setSheetState(() => categoryId = v),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<ItemType>(
                        value: type,
                        decoration: const InputDecoration(labelText: 'Type'),
                        items: ItemType.values
                            .map((t) => DropdownMenuItem(value: t, child: Text(t.label)))
                            .toList(),
                        onChanged: (v) => setSheetState(() => type = v ?? type),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () async {
                          if (nameController.text.trim().isEmpty || categoryId == null) return;
                          final repo = ref.read(itemRepositoryProvider);
                          final item = Item(
                            id: existing?.id ??
                                DateTime.now().microsecondsSinceEpoch.toString(),
                            festId: festId,
                            categoryId: categoryId!,
                            name: nameController.text.trim(),
                            type: type,
                            status: existing?.status ?? ItemStatus.pending,
                          );
                          if (existing == null) {
                            await repo.addItem(item);
                          } else {
                            await repo.updateItem(item);
                          }
                          if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                        },
                        child: const Text('Save'),
                      ),
                    ],
                  );
                },
              );
            },
          ),
        );
      },
    );
  }
}
