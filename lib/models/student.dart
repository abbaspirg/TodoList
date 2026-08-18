import 'package:freezed_annotation/freezed_annotation.dart';

part 'student.freezed.dart';
part 'student.g.dart';

@freezed
class Student with _$Student {
  const factory Student({
    required String id,
    required String festId,
    required String name,
    String? admissionNo,
    required String groupId,
    String? className,
    String? photoUrl,
    String? phone,
    DateTime? createdAt,
  }) = _Student;

  factory Student.fromJson(Map<String, dynamic> json) =>
      _$StudentFromJson(json);
}
