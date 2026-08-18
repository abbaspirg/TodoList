/// Fest-wide role, status and type enums shared across models, repositories
/// and security-rule-mirrored client-side checks.

enum UserRole { admin, judge, public }

enum ItemStatus { pending, ongoing, completed }

enum ItemType { individual, group }

enum StageType { stage, offStage }

enum RegistrationStatus { registered, withdrawn }

extension ItemStatusX on ItemStatus {
  String get label => switch (this) {
        ItemStatus.pending => 'Pending',
        ItemStatus.ongoing => 'Ongoing',
        ItemStatus.completed => 'Completed',
      };
}

extension ItemTypeX on ItemType {
  String get label => switch (this) {
        ItemType.individual => 'Individual',
        ItemType.group => 'Group',
      };
}
