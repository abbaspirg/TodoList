import 'package:madrasa_fest_manager/models/registration.dart';

abstract class RegistrationRepository {
  /// Live participant list for an item — this is what the Judge Panel and
  /// Admin registration screen both stream from.
  Stream<List<Registration>> watchRegistrations(String itemId);
  Future<void> registerStudent(Registration registration);
  Future<void> withdrawRegistration(String registrationId);
}
