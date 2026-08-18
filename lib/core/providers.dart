import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/core/services/auth_service.dart';
import 'package:madrasa_fest_manager/core/services/poster_render_service.dart';
import 'package:madrasa_fest_manager/data/repositories/category_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/group_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/item_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/judge_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/registration_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/result_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/score_repository.dart';
import 'package:madrasa_fest_manager/data/repositories/student_repository.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/category_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/group_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/item_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/judge_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/registration_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/result_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/score_repository_firestore.dart';
import 'package:madrasa_fest_manager/data/repositories_firestore/student_repository_firestore.dart';

/// Every provider in this file is the single place the Firestore
/// implementations get wired to their interfaces — see ARCHITECTURE.md §3.
/// Widgets should only ever depend on the interface providers below, never
/// import a `*_firestore.dart` file directly.

// --- Firebase SDK instances -------------------------------------------------

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);
final firebaseStorageProvider = Provider<FirebaseStorage>((ref) => FirebaseStorage.instance);
final firebaseFunctionsProvider =
    Provider<FirebaseFunctions>((ref) => FirebaseFunctions.instance);

// --- App-level services ------------------------------------------------------

final authServiceProvider =
    Provider<AuthService>((ref) => AuthService(ref.watch(firebaseAuthProvider)));

final posterRenderServiceProvider = Provider<PosterRenderService>(
  (ref) => PosterRenderService(ref.watch(firebaseStorageProvider)),
);

final authStateProvider = StreamProvider<User?>(
  (ref) => ref.watch(authServiceProvider).authStateChanges(),
);

final currentRoleProvider = FutureProvider<UserRole?>((ref) async {
  ref.watch(authStateProvider);
  return ref.watch(authServiceProvider).currentRole();
});

/// The active fest — in a multi-fest-capable deployment this would be
/// selected on an "Choose Fest" screen; hardcoded to the current fest here
/// for the single-fest-per-season common case. See ARCHITECTURE.md §6.
final currentFestIdProvider = StateProvider<String>((ref) => 'current');

// --- Repositories -------------------------------------------------------------

final studentRepositoryProvider = Provider<StudentRepository>(
  (ref) => StudentRepositoryFirestore(ref.watch(firestoreProvider)),
);

final groupRepositoryProvider = Provider<GroupRepository>(
  (ref) => GroupRepositoryFirestore(ref.watch(firestoreProvider)),
);

final categoryRepositoryProvider = Provider<CategoryRepository>(
  (ref) => CategoryRepositoryFirestore(ref.watch(firestoreProvider)),
);

final itemRepositoryProvider = Provider<ItemRepository>(
  (ref) => ItemRepositoryFirestore(ref.watch(firestoreProvider)),
);

final registrationRepositoryProvider = Provider<RegistrationRepository>(
  (ref) => RegistrationRepositoryFirestore(ref.watch(firestoreProvider)),
);

final judgeRepositoryProvider = Provider<JudgeRepository>(
  (ref) => JudgeRepositoryFirestore(
    ref.watch(firestoreProvider),
    ref.watch(firebaseFunctionsProvider),
  ),
);

final scoreRepositoryProvider = Provider<ScoreRepository>(
  (ref) => ScoreRepositoryFirestore(ref.watch(firestoreProvider)),
);

final resultRepositoryProvider = Provider<ResultRepository>(
  (ref) => ResultRepositoryFirestore(ref.watch(firestoreProvider)),
);
