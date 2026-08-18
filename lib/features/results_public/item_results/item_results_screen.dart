import 'package:characters/characters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/result.dart';

const _medals = {1: '🥇', 2: '🥈', 3: '🥉'};

/// Reverse-chronological feed of published results — the screen parents and
/// students actually screenshot and forward. See UI_UX_WORKFLOW.md §4.
class ItemResultsScreen extends ConsumerWidget {
  const ItemResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final resultRepo = ref.watch(resultRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Results')),
      body: StreamBuilder<List<FestResult>>(
        stream: resultRepo.watchPublishedResults(festId),
        builder: (context, snapshot) {
          final results = snapshot.data ?? const [];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (results.isEmpty) {
            return const Center(child: Text('No results published yet.'));
          }
          return ListView.builder(
            itemCount: results.length,
            itemBuilder: (context, i) {
              final result = results[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(result.itemName, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 16,
                        runSpacing: 12,
                        children: result.rankings.take(3).map((r) {
                          return Column(
                            children: [
                              Text(_medals[r.rank] ?? '${r.rank}',
                                  style: const TextStyle(fontSize: 24)),
                              CircleAvatar(
                                radius: 28,
                                backgroundImage: r.studentPhotoUrl != null
                                    ? NetworkImage(r.studentPhotoUrl!)
                                    : null,
                                child: r.studentPhotoUrl == null
                                    ? Text(r.studentName.characters.first)
                                    : null,
                              ),
                              const SizedBox(height: 4),
                              Text(r.studentName, style: const TextStyle(fontSize: 12)),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircleAvatar(radius: 4, backgroundColor: colorFromHex('#999999')),
                                  const SizedBox(width: 4),
                                  Text(r.groupName, style: const TextStyle(fontSize: 11)),
                                ],
                              ),
                            ],
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
