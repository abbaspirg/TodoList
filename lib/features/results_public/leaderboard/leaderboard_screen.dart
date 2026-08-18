import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/group_total.dart';

/// The single most-watched public screen: live Group A vs Group B totals,
/// designed for both a lobby-TV landscape kiosk and a phone in portrait.
/// See UI_UX_WORKFLOW.md §4.
class LeaderboardScreen extends ConsumerWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final groupRepo = ref.watch(groupRepositoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Leaderboard'),
        actions: [
          TextButton(
            onPressed: () => context.push('/public/results'),
            child: const Text('Item Results'),
          ),
        ],
      ),
      body: StreamBuilder<List<GroupTotal>>(
        stream: groupRepo.watchGroupTotals(festId),
        builder: (context, snapshot) {
          final totals = [...(snapshot.data ?? const <GroupTotal>[])]
            ..sort((a, b) => b.totalPoints.compareTo(a.totalPoints));
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (totals.isEmpty) {
            return const Center(child: Text('Scoring has not started yet.'));
          }
          final maxPoints = totals.map((g) => g.totalPoints).reduce((a, b) => a > b ? a : b);

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: totals
                    .map((g) => Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: _GroupColumn(group: g, maxPoints: maxPoints),
                        ))
                    .toList(),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _GroupColumn extends StatelessWidget {
  const _GroupColumn({required this.group, required this.maxPoints});

  final GroupTotal group;
  final double maxPoints;

  @override
  Widget build(BuildContext context) {
    final color = colorFromHex(group.groupColorHex);
    final heightFraction = maxPoints == 0 ? 0.0 : group.totalPoints / maxPoints;

    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(
          group.totalPoints.toStringAsFixed(0),
          style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: color),
        ),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 600),
          width: 100,
          height: 40 + heightFraction * 220,
          decoration: BoxDecoration(
            color: color,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        Text(group.groupName, style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}
