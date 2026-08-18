import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/student_repository.dart';
import 'package:madrasa_fest_manager/models/student.dart';

class StudentRepositoryFirestore implements StudentRepository {
  StudentRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _students(String festId) =>
      _db.collection('fests').doc(festId).collection('students');

  @override
  Stream<List<Student>> watchStudents(String festId, {String? groupId}) {
    Query<Map<String, dynamic>> query = _students(festId);
    if (groupId != null) {
      query = query.where('groupId', isEqualTo: groupId);
    }
    return query.orderBy('name').snapshots().map(
          (snap) => snap.docs
              .map((d) => Student.fromJson({...d.data(), 'id': d.id}))
              .toList(),
        );
  }

  @override
  Future<Student?> getStudent(String studentId) async {
    // festId is embedded in the student doc via a collection-group query
    // since students live under fests/{festId}/students/{id}.
    final results = await _db
        .collectionGroup('students')
        .where(FieldPath.documentId, isEqualTo: studentId)
        .limit(1)
        .get();
    if (results.docs.isEmpty) return null;
    final d = results.docs.first;
    return Student.fromJson({...d.data(), 'id': d.id});
  }

  @override
  Future<void> addStudent(Student student) async {
    await _students(student.festId).doc(student.id).set(student.toJson());
  }

  @override
  Future<void> updateStudent(Student student) async {
    await _students(student.festId).doc(student.id).update(student.toJson());
  }

  @override
  Future<void> deleteStudent(String studentId) async {
    final doc = await getStudent(studentId);
    if (doc == null) return;
    await _students(doc.festId).doc(studentId).delete();
  }
}
