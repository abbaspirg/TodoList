import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/group_total.dart';

/// The Admin hub — fest status, the live Group A vs Group B score bar, and
/// quick navigation into every management area. See UI_UX_WORKFLOW.md §2.
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final festId = ref.watch(currentFestIdProvider);
    final groupTotals = ref.watch(groupRepositoryProvider).watchGroupTotals(festId);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fest Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authServiceProvider).signOut(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StreamBuilder<List<GroupTotal>>(
            stream: groupTotals,
            builder: (context, snapshot) {
              final totals = snapshot.data ?? const [];
              return _GroupScoreBar(totals: totals);
            },
          ),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: [
              _NavCard(icon: Icons.groups, label: 'Students', onTap: () => context.go('/admin/students')),
              _NavCard(icon: Icons.flag, label: 'Groups', onTap: () => context.go('/admin/groups')),
              _NavCard(icon: Icons.category, label: 'Categories', onTap: () => context.go('/admin/categories')),
              _NavCard(icon: Icons.event, label: 'Items', onTap: () => context.go('/admin/items')),
              _NavCard(icon: Icons.how_to_reg, label: 'Registrations', onTap: () => context.go('/admin/registrations')),
              _NavCard(icon: Icons.gavel, label: 'Judges', onTap: () => context.go('/admin/judges')),
              _NavCard(icon: Icons.emoji_events, label: 'Results & Analytics', onTap: () => context.go('/admin/results')),
            ],
          ),
        ],
      ),
    );
  }
}

class _GroupScoreBar extends StatelessWidget {
  const _GroupScoreBar({required this.totals});

  final List<GroupTotal> totals;

  @override
  Widget build(BuildContext context) {
    if (totals.length < 2) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('Group totals will appear once scoring begins.'),
        ),
      );
    }
    final sorted = [...totals]..sort((a, b) => a.groupName.compareTo(b.groupName));
    final maxPoints = sorted.map((g) => g.totalPoints).fold<double>(1, (a, b) => a > b ? a : b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Grand Total', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            for (final g in sorted) ...[
              Row(
                children: [
                  CircleAvatar(radius: 6, backgroundColor: colorFromHex(g.groupColorHex)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(g.groupName)),
                  Text('${g.totalPoints.toStringAsFixed(0)} pts',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: g.totalPoints / maxPoints,
                  minHeight: 8,
                  color: colorFromHex(g.groupColorHex),
                  backgroundColor: colorFromHex(g.groupColorHex).withOpacity(0.15),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32),
            const SizedBox(height: 8),
            Text(label, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
