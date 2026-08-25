# UI / UX Workflow

## 1. Entry & Role Routing

```mermaid
flowchart TD
    A[App Launch] --> B{Logged in?}
    B -- No --> C[Login Screen<br/>email/password or phone OTP]
    C --> D{Role from<br/>roles/uid doc}
    B -- Yes --> D
    D -- admin --> E[Admin Dashboard]
    D -- judge --> F[Judge Item Queue]
    G[Public Display<br/>no login] --> H[Live Leaderboard]
```

A single app binary serves all three roles; the hash router (`mobile/www/js/router.js`)
redirects post-login based on `role` in the user's `roles/{uid}` document. The Public Display flow is
reachable without login via a "View Results" entry point on the login screen
(for parents/students), and separately as a dedicated kiosk build for a lobby
TV.

## 2. Admin Workflow

```mermaid
flowchart LR
    Dash[Dashboard<br/>fest status, quick stats] --> Students[Students]
    Dash --> Groups[Groups]
    Dash --> Categories[Categories]
    Dash --> Items[Items]
    Dash --> Reg[Registrations]
    Dash --> Judges[Judges]
    Dash --> Results[Results & Analytics]

    Students --> StudentForm[Add/Edit Student<br/>name, photo, class, group]
    Groups --> GroupForm[Edit Group<br/>name, color, logo]
    Categories --> CategoryForm[Add/Edit Category<br/>name, age range]
    Items --> ItemForm[Add/Edit Item<br/>name, category, type, stage]
    Reg --> RegForm[Register Student to Item<br/>pick category -> item -> student -> chest no.]
    Judges --> JudgeForm[Add Judge + Assign to Item(s)]
    Results --> ItemResult[Item Result: 1st/2nd/3rd]
    Results --> Leaderboard[Per-Group grand totals]
    Results --> PosterGen[Generate Poster]
```

**Dashboard** — top of the admin app: fest name/year, counts (students, items,
completed vs pending), and a prominent live **per-Group** score bar
(same widget reused on the public leaderboard). Quick actions: "Add Student",
"Add Item", "Open Item for Scoring".

**Students screen** — searchable/filterable list (by group, class, category
eligibility), swipe-to-edit, bulk CSV import for large enrollments (a real pain
point at fest registration time), avatar photo capture via camera or gallery.

**Groups screen** — a plain add/edit/delete list, not a fixed pair: most fests
run 2 competing groups (seeded by default — "Green Brigade" / "Golden Team"),
but some run 3 or more, so Admin can add further groups the same way as
Categories or Items. Each card edits name and color inline.

**Categories screen** — simple reorderable list (Sub-Junior, Junior, Senior,
Super Senior, ...), add/edit/delete, each with an age range used to filter
eligible students during registration.

**Items screen** — list grouped by category, each item shows status chip
(pending/ongoing/completed), tap to edit (name, category, individual vs group,
stage vs off-stage, max participants per group). A prominent **"Open for
Scoring"** toggle here is what flips `status -> ongoing` and pushes to judges.

**Registrations screen** — the core data-entry flow: pick a Category → pick an
Item within it → pick eligible Students (auto-filtered to the category's age
range, showing their Group) → assign chest numbers → save. Shows a running
count per group per item so admins can visually balance participation.

**Judges screen** — add judge (name/email/phone), invite (creates Firebase Auth
account + emails temp password or magic link), assign judge(s) to one or more
items via multi-select.

**Add/edit dialogs** — every admin form (student, item, category, judge) opens
as an overlay dialog over the list it belongs to, not appended underneath it
(`js/modal.js`). That started as a real complaint: on a roster of a hundred
students, tapping "Add Student" looked like it did nothing, because the form
had opened several screens further down. Back — the header button, the Android
hardware button and the system back gesture alike — closes an open dialog
before it does anything to navigation, so a half-filled form is never lost to
a stray swipe.

**Marks screen** (`/admin/scores/:itemId`) — the raw marks behind one item:
every judge's mark for every participant. An admin can edit a mark, delete it,
withdraw a participant (entry stays on record, marks kept) or delete their
entry outright (entry and marks erased). Judges can do none of it — their marks
are create-once, which is what stops anyone revising after seeing another
judge's. Every one of these actions re-derives the item's result immediately,
in both directions: take an item below a full set of marks and the result it
had is withdrawn and the item drops back to `ongoing`, so a published standing
can never outlive the marks it came from.

Deletion is available wherever a record can be created — students, items,
categories, groups, judges, registrations, marks, and a day's attendance mark
(clearing it deletes the record rather than writing a neutral status, since
"not marked" and "marked absent" are different facts the report counts
separately). Each one confirms first and says what else goes with it.

**Results & Analytics** — per-item result cards (medal icons for 1st/2nd/3rd,
participant name + photo + group), a "Publish" button (keeps unpublished
results hidden from the public feed until Admin reviews), and the
**Group Grand Total** view: a large comparative bar/donut across all Groups
cumulative points, plus an item-wise contribution breakdown table.

**Poster Generator** — reachable from a completed+published result: preview of
an auto-composed poster (template with winner photo, name, group badge, rank
medal, item name, fest branding) with **Download** and **Share** (WhatsApp,
etc. via `share_plus`) actions. Batch "Generate all posters for this item"
button creates one poster per medal position in one tap.

## 3. Judge Workflow

```mermaid
flowchart TD
    Q[Item Queue<br/>items assigned to me] --> S{Item status}
    S -- pending --> W[Waiting — greyed out]
    S -- ongoing --> P[Live Participant List<br/>chest no. + name + group]
    P --> M[Marks Entry<br/>per participant, per criterion]
    M --> Sub[Submit]
    Sub --> Locked[Locked — cannot edit<br/>after submit]
```

- **Item Queue** — a judge sees only items they're assigned to (enforced both by
  the query and security rules), sorted with the currently "ongoing" item
  pinned to the top and visually highlighted so there's no ambiguity about
  what's live right now during a fast-moving event.
- **Marks Entry screen** — one participant at a time or a scrollable list of
  cards, each with the item's scoring criteria as labeled sliders/steppers
  (e.g. Voice 0-10, Pronunciation 0-10, Presentation 0-10) sized for quick
  thumb input under time pressure; a running total per participant is shown
  live. **Large, unambiguous Submit button per participant** — once submitted,
  fields lock (read-only) to prevent accidental edits and to preserve scoring
  integrity; a correction requires an Admin-mediated override, logged in
  `scoreCorrections`.
- Offline-safe: if connectivity drops mid-item, entered marks queue locally
  (Firestore offline cache) and sync automatically — judge sees a small
  "syncing" indicator, never a data-loss error.

## 4. Public / Display Workflow

```mermaid
flowchart LR
    L[Live Leaderboard<br/>per-Group totals] --> R[Item Results List]
    R --> D[Item Detail<br/>1st/2nd/3rd + poster thumbnails]
    D --> Share[View/Download Poster]
```

- **Live Leaderboard** — the single most-watched screen during the event
  (designed for a lobby TV in landscape as well as a phone in portrait): big
  group totals updating in real time as results are published, animated on
  change so a crowd watching a shared screen notices updates.
- **Item Results** — reverse-chronological feed of published results, each
  card showing winner photos/names/groups; tapping opens the full poster to
  view/download/share — this is the artifact parents and students actually
  screenshot and forward, so it's the most polished visual surface in the app.

## 5. Cross-Cutting UX Notes

- **Group color coding is consistent everywhere** — every student
  avatar/list-row/result card carries a colored left-border or badge in its
  group's color, so at a glance (without reading text) anyone can tell which
  group a name belongs to; this matters most on the fast-scrolling judge
  scoring screen and the public results feed.
- **Empty states** are written as next-step prompts, not just "no data" (e.g.
  Items screen with zero items shows "Add your first competition item" with
  the Add button inline).
- **Loading/error states**: every Firestore `onSnapshot` listener renders a
  neutral "Loading…" placeholder until its first callback and a toast on a
  caught write error, so a lost-connection judge sees a clear signal instead
  of a frozen screen.
- **Localization**: not yet implemented — see `docs/ARCHITECTURE.md`
  "Non-Functional Notes" for the recommended approach (English + Malayalam at
  minimum, since Meelad fests are commonly run by Malayalam-medium madrasas).
