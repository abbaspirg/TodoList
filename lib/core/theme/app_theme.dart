import 'package:flutter/material.dart';

/// Fest-neutral brand seed; each Group's own [colorHex] (see [Group]) is
/// applied per-widget as an accent (badge/border) on top of this base theme
/// rather than swapping the whole app theme — see UI_UX_WORKFLOW.md §5.
class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF0F6E4F));
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
      ),
      cardTheme: const CardThemeData(
        margin: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0F6E4F),
      brightness: Brightness.dark,
    );
    return ThemeData(useMaterial3: true, colorScheme: scheme);
  }
}

Color colorFromHex(String hex) {
  final cleaned = hex.replaceFirst('#', '');
  return Color(int.parse('FF$cleaned', radix: 16));
}
