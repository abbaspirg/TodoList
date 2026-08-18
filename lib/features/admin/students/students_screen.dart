import 'package:characters/characters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/group.dart';
import 'package:madrasa_fest_manager/models/student.dart';

/// Searchable, group-filterable student list with add/edit — see
/// UI_UX_WORKFLOW.md §2 "Students screen".
class StudentsScreen extends ConsumerStatefulWidget {
  const StudentsScreen({super.key});

  @override
  ConsumerState<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends ConsumerState<StudentsScreen> {
  String _search = '';
  String? _groupFilter;

  @override
  Widget build(BuildContext context) {
    final festId = ref.watch(currentFestIdProvider);
    final studentRepo = ref.watch(studentRepositoryProvider);
    final groupRepo = ref.watch(groupRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Students')),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Add Student'),
        onPressed: () => _showStudentForm(context, festId),
      ),
      body: StreamBuilder<List<Group>>(
        stream: groupRepo.watchGroups(festId),
        builder: (context, groupSnap) {
          final groups = groupSnap.data ?? const [];
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          hintText: 'Search students',
                          isDense: true,
                        ),
                        onChanged: (v) => setState(() => _search = v.toLowerCase()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<String?>(
                      value: _groupFilter,
                      hint: const Text('All groups'),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('All groups')),
                        ...groups.map((g) => DropdownMenuItem(value: g.id, child: Text(g.name))),
                      ],
                      onChanged: (v) => setState(() => _groupFilter = v),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: StreamBuilder<List<Student>>(
                  stream: studentRepo.watchStudents(festId, groupId: _groupFilter),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final students = snapshot.data!
                        .where((s) => s.name.toLowerCase().contains(_search))
                        .toList();
                    if (students.isEmpty) {
                      return const Center(
                        child: Text('No students yet. Tap "Add Student" to get started.'),
                      );
                    }
                    return ListView.builder(
                      itemCount: students.length,
                      itemBuilder: (context, i) {
                        final s = students[i];
                        final group = groups.where((g) => g.id == s.groupId);
                        final groupColor = group.isNotEmpty ? group.first.colorHex : '#999999';
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundImage:
                                s.photoUrl != null ? NetworkImage(s.photoUrl!) : null,
                            child: s.photoUrl == null ? Text(s.name.characters.first) : null,
                          ),
                          title: Text(s.name),
                          subtitle: Text(s.className ?? ''),
                          trailing: CircleAvatar(
                            radius: 6,
                            backgroundColor: colorFromHex(groupColor),
                          ),
                          onTap: () => _showStudentForm(context, festId, existing: s),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showStudentForm(BuildContext context, String festId, {Student? existing}) {
    final nameController = TextEditingController(text: existing?.name);
    final classController = TextEditingController(text: existing?.className);
    String? groupId = existing?.groupId;

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
          child: StreamBuilder<List<Group>>(
            stream: ref.read(groupRepositoryProvider).watchGroups(festId),
            builder: (context, groupSnap) {
              final groups = groupSnap.data ?? const [];
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(existing == null ? 'Add Student' : 'Edit Student',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Full name'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: classController,
                    decoration: const InputDecoration(labelText: 'Class'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: groupId,
                    decoration: const InputDecoration(labelText: 'Group'),
                    items: groups
                        .map((g) => DropdownMenuItem(value: g.id, child: Text(g.name)))
                        .toList(),
                    onChanged: (v) => groupId = v,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () async {
                      if (nameController.text.trim().isEmpty || groupId == null) return;
                      final repo = ref.read(studentRepositoryProvider);
                      final student = Student(
                        id: existing?.id ??
                            DateTime.now().microsecondsSinceEpoch.toString(),
                        festId: festId,
                        name: nameController.text.trim(),
                        className: classController.text.trim(),
                        groupId: groupId!,
                        createdAt: existing?.createdAt ?? DateTime.now(),
                      );
                      if (existing == null) {
                        await repo.addStudent(student);
                      } else {
                        await repo.updateStudent(student);
                      }
                      if (sheetContext.mounted) Navigator.of(sheetContext).pop();
                    },
                    child: const Text('Save'),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}
