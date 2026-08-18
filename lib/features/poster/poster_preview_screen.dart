import 'package:characters/characters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:madrasa_fest_manager/core/providers.dart';
import 'package:madrasa_fest_manager/core/theme/app_theme.dart';
import 'package:madrasa_fest_manager/models/result.dart';
import 'package:screenshot/screenshot.dart';

const _medals = {1: '🥇', 2: '🥈', 3: '🥉'};

/// Renders the poster template on-screen, captures it as a PNG, and offers
/// Download/Share — see ARCHITECTURE.md §1 "Poster generation" and
/// UI_UX_WORKFLOW.md §2 "Poster Generator".
class PosterPreviewScreen extends ConsumerStatefulWidget {
  const PosterPreviewScreen({super.key, required this.result, required this.ranking});

  final FestResult result;
  final RankingEntry ranking;

  @override
  ConsumerState<PosterPreviewScreen> createState() => _PosterPreviewScreenState();
}

class _PosterPreviewScreenState extends ConsumerState<PosterPreviewScreen> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final posterService = ref.watch(posterRenderServiceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Poster')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Screenshot(
                controller: posterService.controller,
                child: _PosterTemplate(result: widget.result, ranking: widget.ranking),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FilledButton.icon(
                    icon: const Icon(Icons.download),
                    label: const Text('Download'),
                    onPressed: _busy ? null : () => _generate(share: false),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.share),
                    label: const Text('Share'),
                    onPressed: _busy ? null : () => _generate(share: true),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _generate({required bool share}) async {
    setState(() => _busy = true);
    try {
      final posterService = ref.read(posterRenderServiceProvider);
      final bytes = await posterService.captureFromWidget();
      final posterId = '${widget.result.itemId}_${widget.ranking.rank}';
      if (share) {
        await posterService.sharePoster(bytes, fileName: '$posterId.png');
      } else {
        await posterService.uploadPoster(posterId: posterId, bytes: bytes);
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(const SnackBar(content: Text('Poster saved.')));
        }
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _PosterTemplate extends StatelessWidget {
  const _PosterTemplate({required this.result, required this.ranking});

  final FestResult result;
  final RankingEntry ranking;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 360,
      height: 480,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colorFromHex('#0F6E4F'), Colors.black87],
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(_medals[ranking.rank] ?? '${ranking.rank}',
              style: const TextStyle(fontSize: 56)),
          const SizedBox(height: 12),
          CircleAvatar(
            radius: 56,
            backgroundImage:
                ranking.studentPhotoUrl != null ? NetworkImage(ranking.studentPhotoUrl!) : null,
            child: ranking.studentPhotoUrl == null
                ? Text(ranking.studentName.characters.first,
                    style: const TextStyle(fontSize: 32))
                : null,
          ),
          const SizedBox(height: 16),
          Text(
            ranking.studentName,
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(ranking.groupName, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 16),
          Text(
            result.itemName,
            style: const TextStyle(color: Colors.white, fontSize: 16),
            textAlign: TextAlign.center,
          ),
          Text('Rank ${ranking.rank}', style: const TextStyle(color: Colors.white54)),
        ],
      ),
    );
  }
}
