import 'package:madrasa_fest_manager/models/student.dart';

/// Backend-agnostic contract for student data access. The Firestore
/// implementation lives in `repositories_firestore/`; a future backend
/// (e.g. a self-hosted API) would implement this same interface without any
/// changes to the `features/` UI layer. See ARCHITECTURE.md §3.
abstract class StudentRepository {
  Stream<List<Student>> watchStudents(String festId, {String? groupId});
  Future<Student?> getStudent(String studentId);
  Future<void> addStudent(Student student);
  Future<void> updateStudent(Student student);
  Future<void> deleteStudent(String studentId);
}
