# SPEC.md — Health & Workout Programming App

> A self-hostable web application to **program and follow exercise routines toward a health goal**.
> Define exercises → compose workouts → schedule them into dated plans → log live sessions → track progress and analytics.

**Status:** Living document — updated as milestones land. Milestone 4 (workout builder) complete.
**Last updated:** 2026-06-22

---

## 1. Overview & Goals

### 1.1 Purpose
A single-deployable web app where a user can build a library of exercises, assemble them into reusable workouts, schedule those workouts into time-bounded plans/routines, log each workout session as they perform it, and track progress over time toward strength, consistency, and body-composition goals.

### 1.2 Target users
- **Primary:** The owner, using it mostly from a phone browser (no native app).
- **Secondary:** Anyone who wants to self-host their own instance via Docker Compose.

### 1.3 Guiding principles
- **Mobile-first responsive web** — usable one-handed at the gym; no native mobile build.
- **Easy self-host** — `docker compose up` and you're running. Single SQLite file, trivial to back up.
- **Multi-user** — one instance can serve several accounts with fully isolated data.
- **Data ownership** — everything lives in one SQLite file on a mounted volume.

### 1.4 Non-goals (v1)
- No native iOS/Android app.
- No social/sharing/feed features.
- No payments, coaching marketplace, or AI workout generation.
- No offline/PWA support in v1 (architecture must keep the door open — see §10).

---

## 2. Tech Stack & Rationale

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One full-stack deployable; React Server Components for data pages, server actions / route handlers for the API. |
| Database | **SQLite** | File-based, zero external service, trivial backup (copy one file), perfect for self-host. |
| ORM / migrations | **Prisma** + Prisma Migrate | Type-safe queries, declarative schema, repeatable migrations + seed. |
| Styling | **Tailwind CSS** (+ shadcn/ui components) | Fast, consistent, mobile-friendly. |
| Auth | **Auth.js (NextAuth) — Credentials provider** + bcrypt | Email/password, JWT session, no third-party dependency. |
| Validation | **Zod** | One schema reused for client form validation and server-side enforcement. |
| Charts | **Recharts** | Simple, responsive line/bar charts for analytics. |
| Runtime/packaging | **Node 20 + Docker Compose** | Single `web` service + named volume for the DB. |

**Future PWA path (out of scope v1):** `next-pwa` / service worker + an IndexedDB "outbox" for offline session logging that syncs on reconnect. The data model and session-logging flow are designed so this can be layered in without schema changes.

---

## 3. Architecture

### 3.1 High-level
```
┌──────────────┐     HTTPS      ┌────────────────────────────┐         ┌──────────────┐
│  Mobile/     │ ─────────────▶ │  Next.js server            │  Prisma │  SQLite file │
│  Desktop     │ ◀───────────── │  • RSC (data pages)        │ ──────▶ │  (on mounted │
│  browser     │                │  • Server actions / routes │ ◀────── │   volume)    │
└──────────────┘                │  • Auth.js session         │         └──────────────┘
                                └────────────────────────────┘
```

### 3.2 Rendering strategy
- **React Server Components** render data-heavy pages (library, plans, analytics) — data fetched directly via Prisma on the server, no client API round-trips.
- **Client components** handle interactivity: live session logging, rest timers, drag-to-reorder, charts.
- **Server actions** mutate data (create/update/delete) with Zod validation and `userId` scoping; a small number of **route handlers** under `app/api/` exist where a fetch endpoint is cleaner (e.g. analytics polling).

### 3.3 Suggested directory layout
```
.
├─ app/
│  ├─ (auth)/login, register/        # public auth pages
│  ├─ (app)/                         # authenticated shell w/ bottom nav
│  │  ├─ dashboard/
│  │  ├─ exercises/
│  │  ├─ workouts/
│  │  ├─ plans/
│  │  ├─ sessions/                   # live logging + history
│  │  ├─ metrics/                    # body metrics
│  │  ├─ goals/
│  │  └─ analytics/
│  └─ api/                           # route handlers where needed
├─ components/                       # shared UI (shadcn/ui based)
├─ lib/
│  ├─ db.ts                          # Prisma client singleton
│  ├─ auth.ts                        # Auth.js config
│  ├─ units.ts                       # kg<->lbs conversion helpers
│  ├─ analytics/                     # 1RM, PR, adherence calculators
│  └─ validation/                    # Zod schemas
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                        # seeded exercise library
├─ docker/entrypoint.sh
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
└─ SPEC.md
```

### 3.4 Mobile UX
- Mobile-first responsive layout; **bottom navigation bar** (Dashboard · Plans · Log · Analytics · More) for thumb reach.
- Large tap targets for in-session weight/rep entry; numeric keypads; minimal navigation while logging.

---

## 4. Data Model

**Canonical storage rule:** all weights stored in **kilograms**; all body length measurements in **centimeters**. Display converts per the user's `unitPreference`. Conversion lives in `lib/units.ts` (`toKg`, `fromKg`, `toCm`, `fromCm`).

### 4.1 Entities (Prisma schema outline)

```prisma
enum UnitPreference { KG LBS }
enum PlanStatus     { DRAFT ACTIVE COMPLETED ARCHIVED }
enum GoalType       { STRENGTH BODY_METRIC CONSISTENCY }
enum GoalStatus     { ACTIVE ACHIEVED FAILED ARCHIVED }
enum Equipment      { BARBELL DUMBBELL MACHINE CABLE KETTLEBELL BODYWEIGHT BAND OTHER }
enum MuscleGroup    { CHEST BACK SHOULDERS BICEPS TRICEPS FOREARMS QUADS HAMSTRINGS
                      GLUTES CALVES ABS OBLIQUES TRAPS LATS NECK FULL_BODY }
enum BodyMetricType { BODYWEIGHT WAIST HIPS CHEST ARM_LEFT ARM_RIGHT
                      THIGH_LEFT THIGH_RIGHT CALF NECK BODY_FAT_PCT }

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  displayName    String
  unitPreference UnitPreference @default(KG)
  isAdmin        Boolean  @default(false)  // first registered user; see §8.7
  createdAt      DateTime @default(now())
  // relations: exercises, workouts, plans, sessions, bodyMetrics, goals
}

model Exercise {
  id              String   @id @default(cuid())
  ownerId         String?              // null = system/seeded, shared read-only
  isSystem        Boolean  @default(false)
  name            String
  description     String?
  equipment       Equipment
  primaryMuscles  MuscleGroup[]
  secondaryMuscles MuscleGroup[]
  createdAt       DateTime @default(now())
  // owner User?  @relation(...)
  @@index([ownerId])
}

model Workout {                          // reusable template
  id          String  @id @default(cuid())
  ownerId     String
  name        String
  description String?
  notes       String?
  exercises   WorkoutExercise[]
}

model WorkoutExercise {                  // ordered exercises within a workout
  id            String @id @default(cuid())
  workoutId     String
  exerciseId    String
  order         Int
  targetSets    Int?
  targetReps    Int?
  targetWeightKg Float?
  restSeconds   Int?
  supersetGroup String?                  // exercises sharing a value are a superset
  notes         String?
  @@index([workoutId])
}

model Plan {                             // routine over a date range
  id          String     @id @default(cuid())
  ownerId     String
  name        String
  description String?
  startDate   DateTime
  endDate     DateTime
  status      PlanStatus @default(DRAFT)
  schedule    PlanScheduleItem[]
  @@index([ownerId, status])
}

model PlanScheduleItem {                 // weekly template, repeated across range
  id        String @id @default(cuid())
  planId    String
  dayOfWeek Int                          // 0=Sun ... 6=Sat
  workoutId String
  @@index([planId])
}

model Session {                          // a logged workout instance
  id              String   @id @default(cuid())
  userId          String
  workoutId       String?               // null = ad-hoc session
  planId          String?               // null = not part of a plan
  scheduledDate   DateTime?             // the day it was meant for (plan adherence)
  startedAt       DateTime
  endedAt         DateTime?
  durationSeconds Int?                  // derived, persisted on completion
  overallEffort   Int?                  // 1..10, whole-session RPE
  notes           String?
  exercises       SessionExercise[]
  @@index([userId, startedAt])
  @@index([planId, scheduledDate])
}

model SessionExercise {
  id         String @id @default(cuid())
  sessionId  String
  exerciseId String
  order      Int
  sets       SessionSet[]
  @@index([sessionId])
  @@index([exerciseId])                  // exercise-over-time queries
}

model SessionSet {
  id              String  @id @default(cuid())
  sessionExerciseId String
  setNumber       Int
  weightKg        Float?
  reps            Int?
  completed       Boolean @default(false)
  restSeconds     Int?                   // actual rest taken
  durationSeconds Int?                   // time under the set
  @@index([sessionExerciseId])
}

model BodyMetric {
  id     String  @id @default(cuid())
  userId String
  date   DateTime
  type   BodyMetricType
  value  Float                           // kg for BODYWEIGHT, cm for lengths, % for body fat
  note   String?
  @@index([userId, type, date])
}

model Goal {
  id         String     @id @default(cuid())
  userId     String
  type       GoalType
  title      String
  targetDate DateTime?
  status     GoalStatus @default(ACTIVE)
  config     Json                        // shape depends on type (below)
  createdAt  DateTime   @default(now())
  @@index([userId, status])
}
```

### 4.2 Goal `config` shapes
- **STRENGTH:** `{ exerciseId, metric: "1RM" | "weightForReps", targetValueKg, reps? }`
  *(e.g. bench press estimated 1RM ≥ 100 kg, or squat 100 kg × 5)*
- **BODY_METRIC:** `{ metricType, targetValue, direction: "increase" | "decrease" }`
  *(e.g. bodyweight 75 kg, direction decrease)*
- **CONSISTENCY:** `{ workoutsPerWeek, windowStart?, windowEnd? }`
  *(evaluated over the linked window or the active plan's range)*

### 4.3 Integrity & indexing notes
- **Cascade deletes:** deleting a `Workout` cascades `WorkoutExercise`; deleting a `Session` cascades `SessionExercise` → `SessionSet`; deleting a `Plan` cascades `PlanScheduleItem`.
- **Exercise deletion:** an exercise referenced by logged sessions is **soft-protected** — block hard delete or detach by copying name into the historical record, so progression history is never lost. (v1: block delete if referenced; offer "archive".)
- **Indexes** target the two hottest query patterns: per-user lists, and per-exercise history over time (`SessionExercise.exerciseId` + `Session.startedAt`).
- **System exercises** (`isSystem = true`, `ownerId = null`) are read-only; "edit" creates an owned clone.

---

## 5. Feature Specifications

### 5.1 Exercise library
- **CRUD** on exercises owned by the user; system/seeded exercises are read-only but clonable.
- Fields: name, description, equipment, primary & secondary muscle groups.
- **Filter/search** by name, muscle group, and equipment.
- **Data touched:** `Exercise`.
- **Screens:** list (filterable), detail, create/edit form.

### 5.2 Workout builder
- Create a named workout = an **ordered list of exercises** with per-exercise targets (sets, reps, weight, rest) and optional notes.
- **Reorder** via drag handle; **supersets** by grouping exercises (`supersetGroup`).
- **Data touched:** `Workout`, `WorkoutExercise`.
- **Screens:** workout list, builder (add/reorder/remove exercises, set targets).

### 5.3 Plans / routines
- A plan = name + description + **start/end date** + a **weekly schedule** mapping days-of-week → workouts.
- Status lifecycle: `DRAFT → ACTIVE → COMPLETED/ARCHIVED`. Only relevant occurrences within `[startDate, endDate]` are considered "scheduled."
- **Occurrence derivation:** for each date in range, look up the weekday's `PlanScheduleItem`(s); each yields a scheduled workout occurrence used for "today's workout" and adherence.
- **Data touched:** `Plan`, `PlanScheduleItem`.
- **Screens:** plan list, plan editor (weekly grid + date range), plan overview (calendar/adherence).

### 5.4 Live session tracking
- Start a session from **today's scheduled workout**, from any workout template, or **ad-hoc** (empty).
- For each exercise: log **weight × reps per set**, mark sets complete, optional per-set duration.
- **Rest timer:** countdown between sets, seeded from the exercise's `restSeconds`; logs actual rest taken.
- On finish: record **session duration** (derived from start/end) and a single **overall effort (1–10)** + notes.
- **Partial completion** supported — unfinished sets simply remain `completed = false`.
- **Data touched:** `Session`, `SessionExercise`, `SessionSet`.
- **Screens:** active-session view (one exercise at a time, big inputs, rest timer), session summary, history list + detail.

### 5.5 Goals
- Create **Strength**, **Body-metric**, or **Consistency** goals (see §4.2).
- **Progress auto-computed** from logged data: strength from session sets (best estimated 1RM / weight-for-reps), body-metric from `BodyMetric` log, consistency from completed sessions vs target/week.
- Auto-transition to `ACHIEVED` when target met by/within `targetDate`.
- **Data touched:** `Goal` (read across `Session*`, `BodyMetric`).
- **Screens:** goal list with progress bars, goal detail with trend chart, create/edit.

### 5.6 Body metrics
- Log **bodyweight** and **measurements** (waist, arms, etc.) over time; one value per type per entry.
- **Data touched:** `BodyMetric`.
- **Screens:** metrics dashboard (per-type trend charts), quick-log form.

---

## 6. Analytics

All calculators live in `lib/analytics/` and operate on `userId`-scoped data.

- **Exercise progression** — per exercise over time: top-set weight, **total volume** (Σ sets×reps×weight), and **estimated 1RM** via the **Epley formula** `1RM = w × (1 + reps/30)`. Rendered as line charts.
- **Personal records (PRs)** — per exercise: best weight, best estimated 1RM, best single-set volume. **PR detection runs on session save** and surfaces badges.
- **Plan adherence / consistency** — scheduled vs completed sessions for active plan, **% on-track**, **current streak**, and **workouts-per-week vs goal**.
- **Volume by muscle group** — weekly volume per `MuscleGroup` (attributed via each exercise's primary muscles), trend over time. *(Computed even though volume isn't a goal type in v1.)*
- **Body-metric trends** — line charts per metric, with the goal target line overlaid.
- **Dashboard / home** — today's scheduled workout, active-goal progress, recent PRs, and an adherence snapshot.

---

## 7. API / Server Actions Surface

Server actions (and a few route handlers) grouped by resource. **Every** action validates input with Zod and scopes all reads/writes to the authenticated `userId`.

| Resource | Actions |
|---|---|
| **Auth** | `register`, `login` (Auth.js), `logout`, `updateProfile` (displayName, unitPreference) |
| **Admin** (admins only, §8.7) | `changeUserPasswordAction`, `deleteUserAction`, `resetUserDataAction`, `setUserRoleAction` (grant/revoke). All re-check `isAdmin` against the DB; destructive ones require the admin's password. |
| **Exercises** | `listExercises(filter)`, `getExercise`, `createExercise`, `updateExercise`, `cloneSystemExercise`, `archiveExercise` |
| **Workouts** | `listWorkouts`, `getWorkout`, `createWorkout`, `updateWorkout`, `reorderWorkoutExercises`, `deleteWorkout` |
| **Plans** | `listPlans`, `getPlan`, `createPlan`, `updatePlan`, `setPlanStatus`, `getPlanOccurrences(range)`, `deletePlan` |
| **Sessions** | `startSession(source)`, `upsertSet`, `setRest`, `completeSession(effort, notes)`, `getSession`, `listSessions`, `deleteSession` |
| **Body metrics** | `logBodyMetric`, `listBodyMetrics(type, range)`, `deleteBodyMetric` |
| **Goals** | `createGoal`, `updateGoal`, `getGoalProgress`, `listGoals`, `setGoalStatus` |
| **Analytics** | `getExerciseProgression(exerciseId)`, `getPRs`, `getAdherence(planId)`, `getMuscleVolume(range)`, `getDashboard` |

---

## 8. Authentication, Authorization & Security

Security is a first-class requirement at every milestone, not a post-ship concern. The principles and controls here apply to all new code regardless of whether the deployment is personal or multi-user.

### 8.1 Auth mechanism

- **Provider:** Auth.js (NextAuth v5) Credentials. Passwords hashed with **bcrypt cost ≥ 12**. Password length is capped at 72 characters in the Zod schema (bcrypt's silent truncation limit — anything beyond 72 bytes hashes identically to the 72-byte prefix).
- **Session strategy:** JWT (no DB session table). The JWT carries `id` and `unitPreference`; default expiry is 30 days.
- **Registration flow:** email + displayName + password + confirmPassword → create `User` → auto sign-in → redirect to `/dashboard`. Passwords must match before any DB write. Gated by `ALLOW_REGISTRATION` env (default `true`); set to `false` after initial account creation to disable open sign-up.
- **First user:** no special admin role in v1. Setting `ALLOW_REGISTRATION=false` after creating your account(s) is the recommended single-user lockdown.
- **Session secret:** `AUTH_SECRET` env var is required; generate with `openssl rand -base64 32`. Never commit a real secret.

### 8.2 Rate limiting

All auth endpoints apply in-process sliding-window rate limiting (`src/lib/rate-limit.ts`) keyed by client IP (`x-forwarded-for`):

| Endpoint | Limit | Window |
|---|---|---|
| Login | 10 attempts / IP | 15 minutes |
| Register | 5 accounts / IP | 1 hour |

Rate limiting is skipped when IP cannot be determined (local dev with no reverse proxy). Behind any standard reverse proxy (Nginx, Caddy) the `x-forwarded-for` header is set automatically. **Apply rate limiting to any new action that is sensitive, expensive, or bulk-writable** — import `checkRateLimit` from `src/lib/rate-limit.ts`.

### 8.3 HTTP security headers

`next.config.ts` injects the following headers on every response:

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Blocks third-party script/frame injection |

> **Dev-only `'unsafe-eval'`:** in development the `script-src` additionally includes `'unsafe-eval'` (gated on `process.env.NODE_ENV` in `next.config.ts`). React's **development** build uses `eval()` for debugging features (e.g. reconstructing call stacks); a CSP without it makes strict browsers — **notably Firefox** — block React's dev runtime, so the client never hydrates and `onClick`/`useState` silently do nothing (native `<form>` POSTs still work, which masks the problem; Chromium is more lenient and may not surface it). React **never** uses `eval()` in production, so the production CSP omits `'unsafe-eval'` and stays strict.
| `X-Frame-Options` | `DENY` | Clickjacking prevention (legacy browsers) |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing prevention |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS after first visit |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevents auth tokens leaking in Referer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Opts out of sensitive browser APIs |

### 8.4 Authorization — data access rules

Strict per-user isolation is enforced at the **data-access layer**, not only at the route or middleware layer:

1. Every query on a user-owned model includes `where: { userId: session.user.id }`.
2. Resource lookup is `where: { userId, id }` — a mismatched `id` returns `null` (indistinguishable from "not found"), so the caller cannot probe for other users' records.
3. System exercises (`isSystem = true`, `ownerId = null`) are the only shared rows; they are readable by all users but not writable.
4. `passwordHash` is never returned to callers. `authorize()` uses an explicit Prisma `select` listing only the fields it needs.
5. All server action inputs pass Zod validation before any DB operation.
6. Error messages at resource boundaries are generic — "not found" and "forbidden" are indistinguishable to the client.

### 8.5 Mandatory checklist for every new server action

Before a server action is considered complete:

- [ ] `auth()` called at the top; `session.user.id` asserted present; early return if absent.
- [ ] All inputs parsed through a Zod schema in `src/lib/validation/`.
- [ ] Every DB read/write scoped to `userId` — no lone `where: { id }`.
- [ ] Prisma `select` specified — no implicit full-row fetches.
- [ ] Rate limit applied if the action is sensitive, expensive, or bulk-writable.
- [ ] Error messages do not reveal existence of other users' resources.
- [ ] No server-only imports (`db.ts`, `auth.ts`) inside `"use client"` files.
- [ ] Admin-only actions re-read `isAdmin` from the **DB** (not the JWT) — see §8.7.

### 8.6 Known limitations accepted for v1

- **JWT session non-revocability:** sign-out deletes the session cookie but the JWT itself remains valid until expiry. A stolen cookie cannot be remotely invalidated without switching to DB sessions or adding a token blocklist. Acceptable for a personal self-hosted deployment; revisit if threat model changes.
- **`script-src 'unsafe-inline'` in CSP:** required by Next.js App Router's inline hydration scripts. The correct fix is nonce injection in `src/proxy.ts` propagated to `<Script>` components; deferred until Next.js makes this straightforward without custom infrastructure.

### 8.7 Admin & user management

The **very first registered user becomes the admin** (`isAdmin = true`, set inside
`registerAction`'s create transaction when `user.count() === 0`). Every later account is a
normal user; `isAdmin` defaults to `false` and is never set by self-registration. An admin
promotes/demotes other users from the in-app **Admin** screen (`/admin`, linked from the
**More** page for admins only).

Admin capabilities (`src/lib/actions/admin.ts`, validated by `src/lib/validation/admin.ts`):

1. **Change any user's password** · 2. **Delete a user** · 3. **Reset a user's data**
   (atomically wipes all domain rows in FK-safe order; user account preserved) ·
4. **Grant/revoke admin** on another user · 5. **View the full user list**.

Authorization model:

- **`isAdmin` flows through the JWT/session** (`auth.config.ts` callbacks → `session.user.isAdmin`).
  The proxy route-guard gates `/admin/*` at the edge and the page re-checks the live session —
  but these are *convenience* gates.
- **The DB is the source of truth.** Every admin action calls `requireAdmin()`, which re-reads
  `isAdmin` from the database, because the JWT can be **stale for up to 30 days** after a demotion
  (§8.6). A demoted user's still-parseable token is rejected at the action boundary; a
  newly-promoted user must sign out and back in before their token reflects admin.
- **Destructive actions require re-authentication** — the admin re-enters their own password
  (`bcrypt.compare` against their hash) to change a password, delete a user, or reset data.
- **Guardrails:** an admin **cannot delete their own account**, and the **last remaining admin
  cannot be demoted** (count checked before revoking) — preventing a lock-out.
- Admin actions are rate-limited (`admin:{ip}`, 30 / 5 min) and return generic boundary errors
  identical to the unauthorized case (§8.4 rule 6).

---

## 9. Deployment — Docker Compose

### 9.1 Components
- **`Dockerfile`** — multi-stage Node 20 build (deps → build → slim runtime), runs `next start`.
- **`docker-compose.yml`** — single `web` service, a **named volume** mounting the SQLite file's directory.
- **`docker/entrypoint.sh`** — on container start: run `prisma migrate deploy`, run the **seed** (idempotent — only inserts system exercises if absent), then start the server.

### 9.2 Environment variables (`.env.example`)
| Var | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite path, e.g. `file:/data/app.db` | `file:/data/app.db` |
| `AUTH_SECRET` | Auth.js JWT signing secret | *(required, generate)* |
| `ALLOW_REGISTRATION` | Enable/disable open sign-up | `true` |
| `PORT` | HTTP port | `3000` |

### 9.3 Run & back up
```bash
cp .env.example .env   # set AUTH_SECRET
docker compose up -d    # migrations + seed run automatically on first boot
```
- **Backup:** stop the container (or use SQLite online backup) and copy the single `app.db` file / the named volume.

---

## 10. Non-functional Requirements & Future Work

### 10.1 Non-functional
- **Mobile-first & responsive** across phone → desktop; large touch targets; minimal in-session navigation.
- **Accessibility basics:** semantic HTML, labelled inputs, sufficient contrast, keyboard-navigable.
- **Validation everywhere:** Zod on both client and server; never trust client input.
- **Timezones/dates:** scheduled dates are date-only (no time) and compared in the user's local day; store as UTC midnight and render locally to avoid off-by-one.
- **Units:** always store canonical (kg/cm); convert only at display/input boundaries.
- **Security — non-negotiable at every milestone:** all controls in §8 apply regardless of deployment scale. Specifically:
  - Every new server action must pass the §8.5 checklist before it is considered done.
  - HTTP security headers are already set globally in `next.config.ts`; do not weaken them without explicit justification.
  - Rate limiting (`src/lib/rate-limit.ts`) must be applied to any new action that is sensitive, expensive, or bulk-writable — not just auth endpoints.
  - User data must never appear in logs, error messages returned to the client, or analytics. Display names and emails are PII.

### 10.2 Future work (explicitly out of scope for v1)
- **PWA + offline session logging** (service worker + IndexedDB outbox, background sync).
- Per-set **RPE/RIR** tracking.
- **Volume goals** as a first-class goal type.
- Exercise **media/images** and demonstration links.
- **Export** (CSV/JSON) and import.
- Social/sharing, multiple-week (non-weekly) plan cycles, deload automation.

---

## 11. Milestones (suggested build order)

1. **Scaffold + auth** — Next.js + Tailwind + Auth.js, register/login, app shell with bottom nav.
2. **Data model + migrations + seed** — full Prisma schema, initial migration, seeded exercise library. *Also: wire the admin "reset user data" action (`resetUserDataAction`, §8.7) to real cascade deletes now that domain models exist.*
3. **Exercise library** — CRUD, filters, clone system exercises.
4. **Workout builder** — create/edit, reorder, supersets, targets.
5. **Plans/routines** — weekly schedule + date range, statuses, "today's workout."
6. **Live session logging** — active-session UI, rest timer, set logging, completion + effort.
7. **Goals + body metrics** — three goal types, body-metric logging, progress computation.
8. **Analytics/dashboard** — progression, PRs, adherence, muscle volume, home dashboard.
9. **Docker Compose polish** — entrypoint migrate+seed, env handling, backup docs, README.

---

## 12. Requirement Coverage Check

| User requirement | Covered in |
|---|---|
| Create exercises (muscle groups, name/desc, equipment) | §4 `Exercise`, §5.1 |
| Create workouts (exercises with weights, reps) | §4 `Workout`/`WorkoutExercise`, §5.2 |
| Create plans/routines (workouts over week, start→end) | §4 `Plan`/`PlanScheduleItem`, §5.3 |
| Track a session (weights, reps, time, overall effort) | §4 `Session`/`SessionSet`, §5.4 |
| Track routine completion / on-track | §6 adherence, §5.3 |
| Track weight-for-exercise over time | §6 exercise progression, §4.3 indexing |
| Other useful analytics | §6 (PRs, muscle volume, body trends, dashboard) |
| Mobile-friendly website, sign-in | §3.4, §8 |
| Runs from Docker Compose | §9 |
| SQLite database | §2, §4, §9 |
