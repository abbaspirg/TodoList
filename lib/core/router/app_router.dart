import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:madrasa_fest_manager/core/constants/app_enums.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/features/admin/categories/categories_screen.dart';
import 'package:madrasa_fest_manager/features/admin/dashboard/admin_dashboard_screen.dart';
import 'package:madrasa_fest_manager/features/admin/groups/groups_screen.dart';
import 'package:madrasa_fest_manager/features/admin/items/items_screen.dart';
import 'package:madrasa_fest_manager/features/admin/judges/judges_screen.dart';
import 'package:madrasa_fest_manager/features/admin/registrations/registrations_screen.dart';
import 'package:madrasa_fest_manager/features/admin/results/results_screen.dart';
import 'package:madrasa_fest_manager/features/admin/students/students_screen.dart';
import 'package:madrasa_fest_manager/features/auth/login_screen.dart';
import 'package:madrasa_fest_manager/features/judge_panel/item_queue/item_queue_screen.dart';
import 'package:madrasa_fest_manager/features/judge_panel/scoring/scoring_screen.dart';
import 'package:madrasa_fest_manager/features/poster/poster_preview_screen.dart';
import 'package:madrasa_fest_manager/features/results_public/item_results/item_results_screen.dart';
import 'package:madrasa_fest_manager/features/results_public/leaderboard/leaderboard_screen.dart';
import 'package:madrasa_fest_manager/models/result.dart';

/// Role-based routing per ARCHITECTURE.md §4 / UI_UX_WORKFLOW.md §1: a
/// single app binary redirects post-login based on the Firebase Auth
/// `role` custom claim, exposed here via [currentRoleProvider].
final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final authAsync = ref.read(authStateProvider);
      final roleAsync = ref.read(currentRoleProvider);
      final loggingIn = state.matchedLocation == '/login';
      final viewingPublic = state.matchedLocation.startsWith('/public');

      if (viewingPublic) return null;

      final user = authAsync.valueOrNull;
      if (user == null) return loggingIn ? null : '/login';

      final role = roleAsync.valueOrNull;
      if (role == null) return null; // wait for claims to resolve

      if (loggingIn) {
        return role == UserRole.admin ? '/admin' : '/judge';
      }
      if (role == UserRole.admin && !state.matchedLocation.startsWith('/admin')) {
        return '/admin';
      }
      if (role == UserRole.judge && !state.matchedLocation.startsWith('/judge')) {
        return '/judge';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),

      // --- Admin ---
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminDashboardScreen(),
        routes: [
          GoRoute(path: 'students', builder: (context, state) => const StudentsScreen()),
          GoRoute(path: 'groups', builder: (context, state) => const GroupsScreen()),
          GoRoute(path: 'categories', builder: (context, state) => const CategoriesScreen()),
          GoRoute(path: 'items', builder: (context, state) => const ItemsScreen()),
          GoRoute(
            path: 'registrations',
            builder: (context, state) => const RegistrationsScreen(),
          ),
          GoRoute(path: 'judges', builder: (context, state) => const JudgesScreen()),
          GoRoute(
            path: 'results',
            builder: (context, state) => const ResultsScreen(),
            routes: [
              GoRoute(
                path: 'poster',
                builder: (context, state) {
                  final extra = state.extra! as Map<String, dynamic>;
                  return PosterPreviewScreen(
                    result: extra['result'] as FestResult,
                    ranking: extra['ranking'] as RankingEntry,
                  );
                },
              ),
            ],
          ),
        ],
      ),

      // --- Judge ---
      GoRoute(
        path: '/judge',
        builder: (context, state) => const ItemQueueScreen(),
        routes: [
          GoRoute(
            path: 'scoring/:itemId',
            builder: (context, state) =>
                ScoringScreen(itemId: state.pathParameters['itemId']!),
          ),
        ],
      ),

      // --- Public (no auth) ---
      GoRoute(
        path: '/public',
        builder: (context, state) => const LeaderboardScreen(),
        routes: [
          GoRoute(
            path: 'results',
            builder: (context, state) => const ItemResultsScreen(),
          ),
        ],
      ),
    ],
  );
});
