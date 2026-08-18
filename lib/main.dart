import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/router/app_router.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  var firebaseReady = true;
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (_) {
    // lib/firebase_options.dart still holds placeholder values until
    // `flutterfire configure` is run against a real project (see
    // README.md "Getting Started"). Fall back to a setup-instructions
    // screen instead of crashing on launch, so the app is still
    // installable/runnable for a UI preview before Firebase is wired up.
    firebaseReady = false;
  }
  runApp(ProviderScope(child: MadrasaFestApp(firebaseReady: firebaseReady)));
}

class MadrasaFestApp extends ConsumerWidget {
  const MadrasaFestApp({super.key, required this.firebaseReady});

  final bool firebaseReady;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!firebaseReady) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: _FirebaseNotConfiguredScreen(),
      );
    }

    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Madrasa Meelad Fest Manager',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'),
        Locale('ml'), // Malayalam — see ARCHITECTURE.md §6 "Localization"
      ],
    );
  }
}

class _FirebaseNotConfiguredScreen extends StatelessWidget {
  const _FirebaseNotConfiguredScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 56),
                const SizedBox(height: 16),
                Text(
                  'Firebase is not configured yet',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                const Text(
                  'This preview build ships with placeholder Firebase '
                  'credentials in lib/firebase_options.dart. Run '
                  '"flutterfire configure" against a real Firebase project '
                  'and rebuild to unlock sign-in and live data — see '
                  'README.md "Getting Started".',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
