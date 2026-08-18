# Database Schema

The domain model is designed relationally first (so it's unambiguous), then mapped
onto Firestore collections (the chosen backend — see `ARCHITECTURE.md`). A
Postgres DDL is also given as a drop-in alternative if the project ever needs a
traditional SQL backend (e.g. a web admin dashboard reusing the same data).

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    FEST ||--o{ GROUP : has
    FEST ||--o{ CATEGORY : has
    FEST ||--o{ STUDENT : has
    FEST ||--o{ JUDGE : has

    GROUP ||--o{ STUDENT : "assigned to"
    GROUP ||--o{ GROUP_TOTAL : "running score"

    CATEGORY ||--o{ ITEM : "groups"

    ITEM ||--o{ REGISTRATION : "has participants"
    ITEM ||--o{ ITEM_JUDGE : "scored by"
    ITEM ||--o{ SCORE : "collects"
    ITEM ||--|| RESULT : "produces"

    STUDENT ||--o{ REGISTRATION : "registers for"
    STUDENT ||--o{ POSTER : "appears on (winner)"

    JUDGE ||--o{ ITEM_JUDGE : "assigned to"
    JUDGE ||--o{ SCORE : submits

    REGISTRATION ||--o{ SCORE : "receives"
    RESULT ||--o{ POSTER : "renders as"

    FEST {
        string id PK
        string name
        int year
        string status
    }
    GROUP {
        string id PK
        string festId FK
        string name
        string colorHex
        string logoUrl
    }
    STUDENT {
        string id PK
        string festId FK
        string name
        string admissionNo
        string groupId FK
        string className
        string photoUrl
        string phone
        datetime createdAt
    }
    CATEGORY {
        string id PK
        string festId FK
        string name
        int minAge
        int maxAge
        int sortOrder
    }
    ITEM {
        string id PK
        string festId FK
        string categoryId FK
        string name
        string type
        string stageType
        int maxParticipantsPerGroup
        string status
        datetime scheduledAt
    }
    REGISTRATION {
        string id PK
        string itemId FK
        string studentId FK
        string groupId FK
        string chestNumber
        string status
    }
    JUDGE {
        string id PK
        string festId FK
        string name
        string email
        string phone
        string authUid
    }
    ITEM_JUDGE {
        string itemId FK
        string judgeId FK
    }
    SCORE {
        string id PK
        string itemId FK
        string registrationId FK
        string judgeId FK
        json   criteriaMarks
        float  totalMarks
        datetime submittedAt
    }
    RESULT {
        string id PK
        string itemId FK
        json   rankings
        datetime finalizedAt
        bool   published
    }
    GROUP_TOTAL {
        string groupId FK
        float  totalPoints
        datetime updatedAt
    }
    POSTER {
        string id PK
        string resultId FK
        string studentId FK
        int    rank
        string imageUrl
        datetime generatedAt
    }
```

## 2. Field Notes

- **`STUDENT.groupId`** — every student belongs to exactly one of the fest's 2
  fixed groups (e.g. "Green Team" / "Golden Team"). Group is a first-class,
  admin-editable entity (name/color/logo), not a hardcoded enum, so it can be
  renamed per fest.
- **`ITEM.type`** — `individual` | `group` (some Meelad items, e.g. group
  songs/Mappila Paattu, register a *team* of students as one participant entry).
- **`ITEM.stageType`** — `stage` | `off-stage`, common Meelad-fest distinction
  affecting scheduling.
- **`REGISTRATION.chestNumber`** — printed on the student's chest number badge;
  unique per item, used by judges to identify participants without needing
  names (common competition practice, reduces bias).
- **`SCORE.criteriaMarks`** — JSON map of sub-criteria to marks, e.g.
  `{ "voice": 8, "pronunciation": 9, "presentation": 7 }`; `totalMarks` is the
  sum/weighted average, computed client-side on submit and re-verified by the
  Cloud Function.
- **`RESULT.rankings`** — JSON array `[{ registrationId, rank, points }, ...]`,
  written once by the result-computation Cloud Function; `published` gates
  visibility on the public leaderboard (Admin can review before publishing).
- **`GROUP_TOTAL`** — one row per group, updated transactionally every time a
  `RESULT` is finalized; this is what the "overall grand total" screen reads —
  it is a materialized aggregate, not computed live from all results every time,
  so the leaderboard stays O(1) to read regardless of how many items have run.
- Point system (rank → points) is a configurable table per fest, not hardcoded,
  e.g.: 1st = 5, 2nd = 3, 3rd = 1, participation = 1 (grade items like A/B/C
  grading, common in Meelad fests, can instead map grade → points).

## 3. Firestore Mapping

Firestore is document/collection based, so the relational model above maps to
**top-level collections scoped under a fest document**, using denormalized
IDs for relationships (no native joins):

```
fests/{festId}
  groups/{groupId}
  categories/{categoryId}
  students/{studentId}
  items/{itemId}                # assignedJudgeIds: [judgeId, ...] denormalized onto the doc
  results/{itemId}              # one result doc per item, doc ID == itemId
  groupTotals/{groupId}         # one doc per group, doc ID == groupId
  posters/{posterId}
  judges/{judgeId}

registrations/{registrationId}  # flat top-level, filtered by itemId field —
scores/{scoreId}                # simpler security rules (both are queried
                                 # across the whole app, not per-fest-scoped)
```

- Denormalize `groupName`, `groupColorHex`, `studentName`, `studentPhotoUrl`
  onto `registrations` documents at write time — the Judge Panel and public
  leaderboard read only from `registrations`/`results` and never need to
  fan-out fetch `students`/`groups` per row, keeping those real-time listeners
  cheap.
- Composite indexes needed: `registrations (itemId, groupId)`,
  `scores (itemId, judgeId)`, `students (festId, groupId)`,
  `items (festId, categoryId, status)`.

## 4. Equivalent Postgres DDL (optional SQL backend)

```sql
create table fests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  status text not null default 'draft'
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid references fests(id) on delete cascade,
  name text not null,
  color_hex text,
  logo_url text
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid references fests(id) on delete cascade,
  name text not null,
  min_age int,
  max_age int,
  sort_order int default 0
);

create table students (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid references fests(id) on delete cascade,
  name text not null,
  admission_no text,
  group_id uuid references groups(id),
  class_name text,
  photo_url text,
  phone text,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid references fests(id) on delete cascade,
  category_id uuid references categories(id),
  name text not null,
  type text not null check (type in ('individual','group')),
  stage_type text check (stage_type in ('stage','off-stage')),
  max_participants_per_group int default 1,
  status text not null default 'pending' check (status in ('pending','ongoing','completed')),
  scheduled_at timestamptz
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  student_id uuid references students(id),
  group_id uuid references groups(id),
  chest_number text,
  status text default 'registered',
  unique (item_id, student_id)
);

create table judges (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid references fests(id) on delete cascade,
  name text not null,
  email text unique,
  phone text,
  auth_uid text
);

create table item_judges (
  item_id uuid references items(id) on delete cascade,
  judge_id uuid references judges(id) on delete cascade,
  primary key (item_id, judge_id)
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  registration_id uuid references registrations(id) on delete cascade,
  judge_id uuid references judges(id),
  criteria_marks jsonb not null,
  total_marks numeric not null,
  submitted_at timestamptz default now(),
  unique (registration_id, judge_id)
);

create table results (
  item_id uuid primary key references items(id) on delete cascade,
  rankings jsonb not null,
  finalized_at timestamptz,
  published boolean default false
);

create table group_totals (
  group_id uuid primary key references groups(id) on delete cascade,
  total_points numeric not null default 0,
  updated_at timestamptz default now()
);

create table posters (
  id uuid primary key default gen_random_uuid(),
  result_item_id uuid references results(item_id) on delete cascade,
  student_id uuid references students(id),
  rank int not null,
  image_url text,
  generated_at timestamptz default now()
);
```
