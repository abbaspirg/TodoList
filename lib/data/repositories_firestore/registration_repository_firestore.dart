import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories/registration_repository.dart';
import 'package:madrasa_fest_manager/models/registration.dart';

class RegistrationRepositoryFirestore implements RegistrationRepository {
  RegistrationRepositoryFirestore(this._db);

  final FirebaseFirestore _db;

  @override
  Stream<List<Registration>> watchRegistrations(String itemId) {
    return _db
        .collectionGroup('registrations')
        .where('itemId', isEqualTo: itemId)
        .orderBy('chestNumber')
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => Registration.fromJson({...d.data(), 'id': d.id}))
              .toList(),
        );
  }

  @override
  Future<void> registerStudent(Registration registration) async {
    // Stored as fests/{festId}/registrations/{id}; the fest scoping is
    // handled by the caller passing a festId-scoped repository instance in
    // a full implementation — kept flat here for brevity.
    await _db
        .collection('registrations')
        .doc(registration.id)
        .set(registration.toJson());
  }

  @override
  Future<void> withdrawRegistration(String registrationId) async {
    await _db.collection('registrations').doc(registrationId).update({
      'status': 'withdrawn',
    });
  }
}
