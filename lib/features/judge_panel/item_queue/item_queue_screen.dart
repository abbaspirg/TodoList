import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/models/item.dart';
import 'package:madrasa_fest_manager/models/judge.dart';

/// Items assigned to the signed-in judge, with the currently "ongoing" item
/// pinned to the top and highlighted — see UI_UX_WORKFLOW.md §3.
class ItemQueueScreen extends ConsumerWidget {
  const ItemQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final authUid = ref.watch(authStateProvider).valueOrNull?.uid;
    final judgeRepo = ref.watch(judgeRepositoryProvider);
    final itemRepo = ref.watch(itemRepositoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Items'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authServiceProvider).signOut(),
          ),
        ],
      ),
      body: StreamBuilder<List<Judge>>(
        stream: judgeRepo.watchJudges(festId),
        builder: (context, judgeSnap) {
          final judges = judgeSnap.data ?? const [];
          final me = judges.where((j) => j.authUid == authUid);
          final assignedIds = me.isNotEmpty ? me.first.assignedItemIds : <String>[];

          return StreamBuilder<List<Item>>(
            stream: itemRepo.watchItems(festId),
            builder: (context, itemSnap) {
              if (!itemSnap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final myItems = itemSnap.data!
                  .where((i) => assignedIds.contains(i.id))
                  .toList()
                ..sort((a, b) {
                  if (a.status == ItemStatus.ongoing) return -1;
                  if (b.status == ItemStatus.ongoing) return 1;
                  return 0;
                });

              if (myItems.isEmpty) {
                return const Center(child: Text('No items assigned to you yet.'));
              }

              return ListView.builder(
                itemCount: myItems.length,
                itemBuilder: (context, i) {
                  final item = myItems[i];
                  final isOngoing = item.status == ItemStatus.ongoing;
                  return Card(
                    color: isOngoing
                        ? Theme.of(context).colorScheme.primaryContainer
                        : null,
                    child: ListTile(
                      title: Text(item.name),
                      subtitle: Text(item.status.label),
                      trailing: isOngoing ? const Icon(Icons.live_tv) : null,
                      enabled: isOngoing,
                      onTap: isOngoing
                          ? () => context.push('/judge/scoring/${item.id}')
                          : null,
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
