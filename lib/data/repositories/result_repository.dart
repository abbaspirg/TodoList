import 'package:madrasa_fest_manager/models/result.dart';

abstract class ResultRepository {
  /// Published results feed for the public/admin results screens, newest
  /// first.
  Stream<List<FestResult>> watchPublishedResults(String festId);
  Stream<FestResult?> watchResult(String itemId);

  /// Admin review gate: results are computed server-side (Cloud Function)
  /// as soon as scoring completes, but stay hidden from the public feed
  /// until an Admin explicitly publishes. See ARCHITECTURE.md §5.
  Future<void> publishResult(String itemId);
}
