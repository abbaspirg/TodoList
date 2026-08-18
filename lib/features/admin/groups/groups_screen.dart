import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/group.dart';

/// Exactly the fest's 2 fixed groups, editable (name/color/logo) but not
/// created/deleted from the UI — see UI_UX_WORKFLOW.md §2 "Groups screen".
class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final groupRepo = ref.watch(groupRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Groups')),
      body: StreamBuilder<List<Group>>(
        stream: groupRepo.watchGroups(festId),
        builder: (context, snapshot) {
          final groups = snapshot.data ?? const [];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: groups
                .map((g) => Card(
                      child: ListTile(
                        leading: CircleAvatar(backgroundColor: colorFromHex(g.colorHex)),
                        title: Text(g.name),
                        trailing: IconButton(
                          icon: const Icon(Icons.edit),
                          onPressed: () => _editGroup(context, ref, g),
                        ),
                      ),
                    ))
                .toList(),
          );
        },
      ),
    );
  }

  void _editGroup(BuildContext context, WidgetRef ref, Group group) {
    final nameController = TextEditingController(text: group.name);
    var colorHex = group.colorHex;

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Edit Group'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Group name'),
              ),
              const SizedBox(height: 8),
              TextFormField(
                initialValue: colorHex,
                decoration: const InputDecoration(labelText: 'Color (#RRGGBB)'),
                onChanged: (v) => colorHex = v,
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
                await ref.read(groupRepositoryProvider).updateGroup(
                      group.copyWith(name: nameController.text.trim(), colorHex: colorHex),
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
