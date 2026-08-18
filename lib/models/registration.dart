import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';

part 'registration.freezed.dart';
part 'registration.g.dart';

/// Assigns a [Student] to an [Item] under their [Group], with a chest number
/// for judge-facing anonymity. Fields are denormalized (studentName,
/// groupName, groupColorHex, ...) per DATABASE_SCHEMA.md §3 so the live Judge
/// Panel and public leaderboard never need to fan out to `students`/`groups`.
@freezed
class Registration with _$Registration {
  const factory Registration({
    required String id,
    required String itemId,
    required String studentId,
    required String studentName,
    String? studentPhotoUrl,
    required String groupId,
    required String groupName,
    required String groupColorHex,
    required String chestNumber,
    @Default(RegistrationStatus.registered) RegistrationStatus status,
  }) = _Registration;

  factory Registration.fromJson(Map<String, dynamic> json) =>
      _$RegistrationFromJson(json);
}
