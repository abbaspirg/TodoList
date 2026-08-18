import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/result.dart';

const _medals = {1: '🥇', 2: '🥈', 3: '🥉'};

/// Per-item results (1st/2nd/3rd) with a Publish gate and a jump into the
/// Poster Generator — see UI_UX_WORKFLOW.md §2 "Results & Analytics".
class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final resultRepo = ref.watch(resultRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Results & Analytics')),
      body: StreamBuilder<List<FestResult>>(
        stream: resultRepo.watchPublishedResults(festId),
        builder: (context, snapshot) {
          final results = snapshot.data ?? const [];
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (results.isEmpty) {
            return const Center(
              child: Text('No results yet. Open an item for scoring to get started.'),
            );
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
                      Row(
                        children: [
                          Expanded(
                            child: Text(result.itemName,
                                style: Theme.of(context).textTheme.titleMedium),
                          ),
                          if (!result.published)
                            FilledButton.tonal(
                              onPressed: () => resultRepo.publishResult(result.itemId),
                              child: const Text('Publish'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (final ranking in result.rankings.take(3))
                        ListTile(
                          dense: true,
                          leading: Text(_medals[ranking.rank] ?? '${ranking.rank}',
                              style: const TextStyle(fontSize: 20)),
                          title: Text(ranking.studentName),
                          subtitle: Row(
                            children: [
                              CircleAvatar(
                                  radius: 5, backgroundColor: colorFromHex('#999999')),
                              const SizedBox(width: 6),
                              Text('${ranking.groupName} · ${ranking.points} pts'),
                            ],
                          ),
                          trailing: TextButton.icon(
                            icon: const Icon(Icons.image_outlined, size: 18),
                            label: const Text('Poster'),
                            onPressed: () => context.push(
                              '/admin/results/poster',
                              extra: {'result': result, 'ranking': ranking},
                            ),
                          ),
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
