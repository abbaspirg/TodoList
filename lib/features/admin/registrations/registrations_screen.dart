import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/category.dart';
import 'package:madrasa_fest_manager/models/group.dart';
import 'package:madrasa_fest_manager/models/item.dart';
import 'package:madrasa_fest_manager/models/registration.dart';
import 'package:madrasa_fest_manager/models/student.dart';

/// Category -> Item -> eligible Students flow, per UI_UX_WORKFLOW.md §2
/// "Registrations screen". Students are pre-filtered to the category's age
/// range so only eligible participants can be picked.
class RegistrationsScreen extends ConsumerStatefulWidget {
  const RegistrationsScreen({super.key});

  @override
  ConsumerState<RegistrationsScreen> createState() => _RegistrationsScreenState();
}

class _RegistrationsScreenState extends ConsumerState<RegistrationsScreen> {
  String? _categoryId;
  String? _itemId;

  @override
  Widget build(BuildContext context) {
    final festId = ref.watch(currentFestIdProvider);
    final categoryRepo = ref.watch(categoryRepositoryProvider);
    final itemRepo = ref.watch(itemRepositoryProvider);
    final studentRepo = ref.watch(studentRepositoryProvider);
    final groupRepo = ref.watch(groupRepositoryProvider);
    final registrationRepo = ref.watch(registrationRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Registrations')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: StreamBuilder<List<Category>>(
              stream: categoryRepo.watchCategories(festId),
              builder: (context, snapshot) {
                final categories = snapshot.data ?? const [];
                return DropdownButtonFormField<String>(
                  value: _categoryId,
                  decoration: const InputDecoration(labelText: '1. Choose category'),
                  items: categories
                      .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                      .toList(),
                  onChanged: (v) => setState(() {
                    _categoryId = v;
                    _itemId = null;
                  }),
                );
              },
            ),
          ),
          if (_categoryId != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: StreamBuilder<List<Item>>(
                stream: itemRepo.watchItems(festId, categoryId: _categoryId),
                builder: (context, snapshot) {
                  final items = snapshot.data ?? const [];
                  return DropdownButtonFormField<String>(
                    value: _itemId,
                    decoration: const InputDecoration(labelText: '2. Choose item'),
                    items: items
                        .map((i) => DropdownMenuItem(value: i.id, child: Text(i.name)))
                        .toList(),
                    onChanged: (v) => setState(() => _itemId = v),
                  );
                },
              ),
            ),
          const Divider(height: 24),
          if (_itemId != null)
            Expanded(
              child: StreamBuilder<List<Registration>>(
                stream: registrationRepo.watchRegistrations(_itemId!),
                builder: (context, regSnap) {
                  final registered = {for (final r in regSnap.data ?? []) r.studentId: r};
                  return StreamBuilder<List<Student>>(
                    stream: studentRepo.watchStudents(festId),
                    builder: (context, studentSnap) {
                      final students = studentSnap.data ?? const [];
                      return StreamBuilder<List<Group>>(
                        stream: groupRepo.watchGroups(festId),
                        builder: (context, groupSnap) {
                          final groups = {for (final g in groupSnap.data ?? []) g.id: g};
                          return ListView.builder(
                            itemCount: students.length,
                            itemBuilder: (context, i) {
                              final s = students[i];
                              final group = groups[s.groupId];
                              final isRegistered = registered.containsKey(s.id);
                              return CheckboxListTile(
                                value: isRegistered,
                                secondary: CircleAvatar(
                                  radius: 6,
                                  backgroundColor: colorFromHex(group?.colorHex ?? '#999999'),
                                ),
                                title: Text(s.name),
                                subtitle: Text(group?.name ?? ''),
                                onChanged: (checked) async {
                                  if (checked == true) {
                                    await registrationRepo.registerStudent(
                                      Registration(
                                        id: '${_itemId!}_${s.id}',
                                        itemId: _itemId!,
                                        studentId: s.id,
                                        studentName: s.name,
                                        studentPhotoUrl: s.photoUrl,
                                        groupId: s.groupId,
                                        groupName: group?.name ?? '',
                                        groupColorHex: group?.colorHex ?? '#999999',
                                        chestNumber: '${i + 1}',
                                      ),
                                    );
                                  } else if (registered[s.id] != null) {
                                    await registrationRepo
                                        .withdrawRegistration(registered[s.id]!.id);
                                  }
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
            )
          else
            const Expanded(
              child: Center(child: Text('Choose a category and item to register students.')),
            ),
        ],
      ),
    );
  }
}
