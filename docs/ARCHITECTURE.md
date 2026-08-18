# Madrasa Meelad Fest Management App — Architecture

## 1. Overview

A cross-platform mobile app (Flutter, single codebase for Android + iOS) that runs a
Meelad Fest (Islamic cultural/arts competition) end-to-end: registering students into
two competing Groups, defining categories and competition items, registering
participants, letting judges score participants live, computing results/rankings,
tracking the overall Group vs Group score, and auto-generating shareable result
posters.

Three user roles share one codebase, gated by role-based navigation and backend
security rules:

| Role | Can do |
|---|---|
| **Admin / Coordinator** | Full CRUD on students, groups, categories, items, registrations, judges. Publishes results, generates posters, views analytics. |
| **Judge** | Sees only items assigned to them, sees the live participant list for the item currently open for scoring, submits marks. Cannot edit other judges' scores or unrelated items. |
| **Public / Display (read-only)** | Live leaderboard, published results, posters — for a lobby TV screen or students'/parents' own phones. No login required (or anonymous auth). |

## 2. Tech Stack

- **Client:** Flutter (Dart) — one codebase for Android/iOS, plus web build for the
  "Public Display" screen (can run on a lobby TV/kiosk).
- **State management:** Riverpod (`flutter_riverpod` + code-gen `riverpod_generator`).
- **Models:** `freezed` + `json_serializable` for immutable, serializable data classes.
- **Navigation:** `go_router`, with role-based redirect guards.
- **Backend:** Firebase, chosen because scoring is inherently a live/real-time,
  multi-writer problem (many judges submitting concurrently) and the fest is a
  short, bursty event — a managed real-time backend avoids building a custom
  WebSocket server for a one-week-a-year workload.
  - **Firestore** — primary database, real-time listeners for judges' live
    participant lists and the public leaderboard.
  - **Firebase Auth** — email/password (or phone OTP) for Admin & Judges; custom
    claims carry `role` and (for judges) `assignedItemIds`.
  - **Cloud Storage** — student photos, generated poster images.
  - **Cloud Functions** — server-side, tamper-proof result computation (rank +
    group totals), poster template rendering trigger, notifications.
  - **Cloud Messaging (FCM)** — "your item is now open for scoring" push to
    judges; "results published" push to public/students.
- **Offline:** Firestore's built-in offline persistence — judges can keep scoring
  on a flaky venue Wi-Fi; writes sync once connectivity returns.
- **Poster generation:** client-side widget-to-image (`RepaintBoundary` +
  `screenshot`/`share_plus`) for on-device instant preview & share, with an
  equivalent Cloud Function (headless Chromium via a small Node service, or
  `image` package templating) that renders the same poster server-side so it can
  be regenerated/re-shared later without the original device.

## 3. Layered / Feature-First Architecture

```
lib/
  core/
    theme/              # colors, typography, both group brand colors
    router/              # go_router config + role guards
    constants/            # point-system constants, enums
    services/
      auth_service.dart          # Firebase Auth wrapper
      firestore_service.dart     # generic CRUD helpers
      storage_service.dart       # photo/poster upload
      poster_render_service.dart # widget -> image
      notification_service.dart  # FCM
  models/                 # freezed data classes (mirrors DB schema, see below)
    student.dart
    group.dart
    category.dart
    item.dart
    participant.dart
    judge.dart
    score.dart
    result.dart
    poster.dart
  data/
    repositories/          # interfaces
    repositories_firestore/  # Firestore implementations of the interfaces
  features/
    auth/                  # login, role redirect
    admin/
      dashboard/
      students/            # list, add/edit, group assignment, bulk import
      groups/               # 2 fixed groups, editable name/color/logo
      categories/            # dynamic category CRUD
      items/                 # item CRUD, map item -> category, schedule, stage status
      registrations/         # assign students to items (per category/group)
      judges/                 # judge accounts, assign judges to items
      results/                # publish results, override/finalize ties
      analytics/              # group-vs-group live score, item-wise breakdown
    judge_panel/
      item_queue/             # items assigned to this judge, "open for scoring" state
      scoring/                 # live participant list + marks entry per item
    results_public/
      leaderboard/             # live Group A vs Group B total
      item_results/             # 1st/2nd/3rd per item
    poster/
      poster_preview/          # generated poster + share/download
  main.dart
```

- **Presentation** (screens/widgets) only reads from Riverpod providers and calls
  notifier methods — no direct Firestore calls in widgets.
- **State** (Riverpod notifiers/streams) exposes `AsyncValue<T>` streams built on
  top of repositories; screens react to Firestore's real-time streams
  automatically (no manual refresh needed for judges' or public's live views).
- **Domain** (repository interfaces) decouples business logic from Firestore so
  the backend could be swapped later (e.g. to a self-hosted Postgres+Node API)
  without touching UI code.
- **Data** (Firestore repository implementations) is the only layer that imports
  `cloud_firestore`.

## 4. Roles & Access Control

- Firebase Auth custom claims: `{ role: "admin" | "judge", assignedItems: [itemId, ...] }`
  set by an Admin action (Cloud Function `assignJudgeToItem` updates claims).
- Firestore Security Rules enforce, server-side:
  - Only `role == "admin"` may write to `students`, `groups`, `categories`,
    `items`, `registrations`, `judges`.
  - A judge may only **create** a `scores` document where
    `judgeId == request.auth.uid` AND `itemId in request.auth.token.assignedItems`,
    and only while the parent `items/{itemId}.status == "ongoing"`.
  - A judge **cannot update or delete** a score once submitted (append-only —
    corrections go through an Admin-only `scoreCorrections` audit trail).
  - `results` and `posters` are public-readable, admin/Cloud-Function-writable
    only (never written directly by a judge or the public).
- Public/Display screen uses Firebase Anonymous Auth (or no auth, if rules allow
  unauthenticated read of `results`, `leaderboard`, `posters` collections only).

## 5. Real-Time Scoring & Result Computation Flow

1. Admin sets an item's `status` to `ongoing` and opens it for scoring — this is
   the single source of truth judges watch via a Firestore stream.
2. Judge Panel streams `registrations` where `itemId == current` to show the live
   participant/chest-number list.
3. Each assigned judge submits one `scores` document per participant
   (`{ itemId, participantId, judgeId, marks, criteria: {...}, submittedAt }`).
   Marks entry is validated client-side (min/max per criterion) before write.
4. A Firestore-triggered Cloud Function (`onScoreWrite`) recomputes, per
   participant: `totalMarks = average(marks across judges who have submitted)`.
   When **all** assigned judges for that item have submitted (or Admin manually
   force-finalizes), the function:
   - Ranks participants by `totalMarks` (tie-break: configurable — e.g. highest
     single-judge score, or Admin manual tie-break screen).
   - Writes `results/{itemId}` with ranked list + points-per-rank (from the
     configurable point table, e.g. 1st=5, 2nd=3, 3rd=1, participation=1).
   - Increments each winner's **Group's** running total in `groupTotals/{groupId}`
     (atomic Firestore transaction/`FieldValue.increment`), which is what the
     public leaderboard and Admin analytics screen read live.
   - Sets `items/{itemId}.status = "completed"`.
5. Poster generation triggers off `results/{itemId}` being written — Admin (or
   an automatic Cloud Function) renders one poster per medal position.

## 6. Non-Functional Notes

- **Scale target:** a single fest (hundreds of students, dozens of items, a
  handful of judges) — Firestore's free/low tier comfortably covers this; no
  custom backend ops burden between fest seasons.
- **Multi-fest / multi-year:** top-level `fests/{festId}` document scopes every
  collection below it, so the same app instance can run next year's fest without
  data collisions, and past fests remain browsable as read-only archives.
- **Localization:** `flutter_localizations` with English + Malayalam (and
  optionally Arabic) since Meelad fests are commonly run by Malayalam-medium
  madrasas — all UI strings externalized from day one via `.arb` files.
- **Accessibility:** large tap targets and high-contrast group colors for the
  Judge scoring screen (used quickly, under time pressure, sometimes by older
  judges).
