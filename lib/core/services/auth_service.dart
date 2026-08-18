import 'package:firebase_auth/firebase_auth.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';

/// Thin wrapper over Firebase Auth exposing the `role` custom claim (set by
/// a Cloud Function when an Admin creates/assigns a user — see
/// ARCHITECTURE.md §4). No Firestore/Firebase types leak past this class
/// into the UI layer.
class AuthService {
  AuthService(this._auth);

  final FirebaseAuth _auth;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserRole?> currentRole() async {
    final user = _auth.currentUser;
    if (user == null) return null;
    final token = await user.getIdTokenResult(true);
    final role = token.claims?['role'] as String?;
    for (final r in UserRole.values) {
      if (r.name == role) return r;
    }
    return null;
  }

  Future<void> signInWithEmail(String email, String password) {
    return _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> signInAnonymously() => _auth.signInAnonymously();

  Future<void> signOut() => _auth.signOut();
}
