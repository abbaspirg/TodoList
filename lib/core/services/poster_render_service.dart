import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:screenshot/screenshot.dart';
import 'package:share_plus/share_plus.dart';

/// Renders the on-screen poster template widget to a PNG and uploads it, so
/// the same pixel-perfect layout the Admin previews is what gets stored and
/// shared — no separate server-side template to keep in sync for the common
/// "generate one poster right after a result" path. A Cloud Function
/// equivalent (see ARCHITECTURE.md §1) exists to re-render posters later
/// without the original device, using the same template data (stored on the
/// `Poster` document) rendered headlessly.
class PosterRenderService {
  PosterRenderService(this._storage);

  final FirebaseStorage _storage;
  final ScreenshotController controller = ScreenshotController();

  Future<Uint8List> captureFromWidget() async {
    final bytes = await controller.capture(pixelRatio: 3);
    if (bytes == null) {
      throw StateError('Poster capture failed — no bytes returned.');
    }
    return bytes;
  }

  Future<String> uploadPoster({
    required String posterId,
    required Uint8List bytes,
  }) async {
    final ref = _storage.ref('posters/$posterId.png');
    await ref.putData(bytes, SettableMetadata(contentType: 'image/png'));
    return ref.getDownloadURL();
  }

  Future<void> sharePoster(Uint8List bytes, {required String fileName}) async {
    await Share.shareXFiles(
      [XFile.fromData(bytes, name: fileName, mimeType: 'image/png')],
    );
  }
}
