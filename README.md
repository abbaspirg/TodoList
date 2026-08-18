# Madrasa Meelad Fest Manager

A Flutter + Firebase mobile app for running a Madrasa Meelad Fest end-to-end:
register students into 2 competing Groups, define categories and competition
items, register participants, let judges score live, compute item-wise
results and the overall Group grand total, and auto-generate shareable result
posters.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, layered
  architecture, roles & access control, real-time scoring flow.
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — ERD, Firestore
  collection mapping, equivalent Postgres DDL.
- [`docs/UI_UX_WORKFLOW.md`](docs/UI_UX_WORKFLOW.md) — screen flows and
  wireframe descriptions for the Admin, Judge, and Public roles.

## Project Structure

```
lib/
  core/        theme, router, constants, services (auth, poster rendering)
  models/      freezed data classes mirroring the DB schema
  data/        repository interfaces + Firestore implementations
  features/    one folder per screen area (admin/*, judge_panel/*, ...)
functions/     Cloud Functions: result computation, judge assignment
firestore.rules, firestore.indexes.json, storage.rules
```

## Getting Started

1. **Install Flutter** (3.22+) — https://docs.flutter.dev/get-started/install
2. **Create a Firebase project** and enable: Authentication (Email/Password
   + Anonymous), Firestore, Storage, Functions, Cloud Messaging.
3. **Configure Firebase for this app**:
   ```
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```
   This overwrites the placeholder `lib/firebase_options.dart` with your
   project's real values.
4. **Install dependencies and generate models**:
   ```
   flutter pub get
   dart run build_runner build --delete-conflicting-outputs
   ```
5. **Deploy backend rules & functions**:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
6. **Run the app**:
   ```
   flutter run
   ```

### Seeding an Admin user

Set the `role: "admin"` custom claim on your first user (e.g. via a one-off
Cloud Functions script or the Firebase Admin SDK) — every other Admin/Judge
account is then managed from inside the app.
