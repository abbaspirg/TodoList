import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/item.dart';
import 'package:madrasa_fest_manager/models/registration.dart';
import 'package:madrasa_fest_manager/models/score.dart';

/// Live participant list + marks entry, sized for fast thumb input under
/// time pressure. Locks a card once submitted. See UI_UX_WORKFLOW.md §3.
class ScoringScreen extends ConsumerWidget {
  const ScoringScreen({super.key, required this.itemId});

  final String itemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final judgeId = ref.watch(authStateProvider).valueOrNull?.uid ?? '';
    final registrationRepo = ref.watch(registrationRepositoryProvider);
    final scoreRepo = ref.watch(scoreRepositoryProvider);
    final itemRepo = ref.watch(itemRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Score Participants')),
      body: StreamBuilder<Item?>(
        stream: itemRepo.watchItem(itemId),
        builder: (context, itemSnap) {
          final item = itemSnap.data;
          final criteria = item?.scoringCriteria ?? const ['Voice', 'Pronunciation', 'Presentation'];

          return StreamBuilder<List<Registration>>(
            stream: registrationRepo.watchRegistrations(itemId),
            builder: (context, regSnap) {
              final registrations = regSnap.data ?? const [];
              if (!regSnap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return StreamBuilder<List<Score>>(
                stream: scoreRepo.watchScoresByJudge(itemId, judgeId),
                builder: (context, scoreSnap) {
                  final submitted = {
                    for (final s in scoreSnap.data ?? []) s.registrationId: s,
                  };
                  return ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: registrations.length,
                    itemBuilder: (context, i) {
                      final reg = registrations[i];
                      final existingScore = submitted[reg.id];
                      return _ParticipantScoreCard(
                        registration: reg,
                        criteria: criteria,
                        existingScore: existingScore,
                        onSubmit: (marks) async {
                          final total = marks.values.fold<num>(0, (a, b) => a + b);
                          await scoreRepo.submitScore(
                            Score(
                              id: '',
                              itemId: itemId,
                              registrationId: reg.id,
                              judgeId: judgeId,
                              criteriaMarks: marks,
                              totalMarks: total.toDouble(),
                            ),
                          );
                        },
                      );
                    },
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

class _ParticipantScoreCard extends StatefulWidget {
  const _ParticipantScoreCard({
    required this.registration,
    required this.criteria,
    required this.existingScore,
    required this.onSubmit,
  });

  final Registration registration;
  final List<String> criteria;
  final Score? existingScore;
  final void Function(Map<String, num> marks) onSubmit;

  @override
  State<_ParticipantScoreCard> createState() => _ParticipantScoreCardState();
}

class _ParticipantScoreCardState extends State<_ParticipantScoreCard> {
  late Map<String, double> _marks = {
    for (final c in widget.criteria) c: (widget.existingScore?.criteriaMarks[c] ?? 5).toDouble(),
  };
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final locked = widget.existingScore != null;
    final total = _marks.values.fold<double>(0, (a, b) => a + b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 6,
                  backgroundColor: colorFromHex(widget.registration.groupColorHex),
                ),
                const SizedBox(width: 8),
                Text('#${widget.registration.chestNumber}',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                Expanded(child: Text(widget.registration.studentName)),
                if (locked) const Icon(Icons.lock, size: 18, color: Colors.grey),
              ],
            ),
            const Divider(),
            for (final criterion in widget.criteria)
              Row(
                children: [
                  SizedBox(width: 110, child: Text(criterion)),
                  Expanded(
                    child: Slider(
                      value: _marks[criterion] ?? 0,
                      min: 0,
                      max: 10,
                      divisions: 10,
                      label: _marks[criterion]?.toStringAsFixed(0),
                      onChanged: locked
                          ? null
                          : (v) => setState(() => _marks[criterion] = v),
                    ),
                  ),
                  SizedBox(width: 24, child: Text(_marks[criterion]?.toStringAsFixed(0) ?? '')),
                ],
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total: ${total.toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                FilledButton(
                  onPressed: locked || _submitting
                      ? null
                      : () async {
                          setState(() => _submitting = true);
                          widget.onSubmit(_marks);
                        },
                  child: Text(locked ? 'Submitted' : 'Submit'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
