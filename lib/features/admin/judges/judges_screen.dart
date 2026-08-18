import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/models/item.dart';
import 'package:madrasa_fest_manager/models/judge.dart';

/// Add judge accounts and assign them to items — see
/// UI_UX_WORKFLOW.md §2 "Judges screen".
class JudgesScreen extends ConsumerWidget {
  const JudgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final judgeRepo = ref.watch(judgeRepositoryProvider);
    final itemRepo = ref.watch(itemRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Judges')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Add Judge'),
        onPressed: () => _showAddJudge(context, ref, festId),
      ),
      body: StreamBuilder<List<Judge>>(
        stream: judgeRepo.watchJudges(festId),
        builder: (context, snapshot) {
          final judges = snapshot.data ?? const [];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (judges.isEmpty) {
            return const Center(child: Text('No judges added yet.'));
          }
          return StreamBuilder<List<Item>>(
            stream: itemRepo.watchItems(festId),
            builder: (context, itemSnap) {
              final items = itemSnap.data ?? const [];
              return ListView.builder(
                itemCount: judges.length,
                itemBuilder: (context, i) {
                  final judge = judges[i];
                  return ExpansionTile(
                    leading: const CircleAvatar(child: Icon(Icons.gavel)),
                    title: Text(judge.name),
                    subtitle: Text(judge.email ?? judge.phone ?? ''),
                    children: [
                      for (final item in items)
                        CheckboxListTile(
                          title: Text(item.name),
                          value: judge.assignedItemIds.contains(item.id),
                          onChanged: (checked) {
                            final updated = [...judge.assignedItemIds];
                            if (checked == true) {
                              updated.add(item.id);
                            } else {
                              updated.remove(item.id);
                            }
                            judgeRepo.assignJudgeToItems(judge.id, updated);
                          },
                        ),
                    ],
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  void _showAddJudge(BuildContext context, WidgetRef ref, String festId) {
    final nameController = TextEditingController();
    final emailController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Add Judge'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: emailController,
                decoration: const InputDecoration(labelText: 'Email'),
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
                await ref.read(judgeRepositoryProvider).addJudge(
                      Judge(
                        id: DateTime.now().microsecondsSinceEpoch.toString(),
                        festId: festId,
                        name: nameController.text.trim(),
                        email: emailController.text.trim(),
                      ),
                    );
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
