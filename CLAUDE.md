@AGENTS.md

# Health — Workout Programming App

Self-hostable, mobile-first web app to program & follow exercise routines toward a
health goal. **Read [SPEC.md](./SPEC.md) for the full architecture and the milestone
roadmap (§11).** This file is the quick-start; SPEC.md is the source of truth.

## Status

- **Milestone 1 (scaffold + auth + app shell): DONE & verified** (lint + build + HTTP login flow).
- **Security hardening (post-M1): DONE** — headers, rate limiting, email-enumeration fix,
  bcrypt cap, select scoping, password confirmation, ALLOW_REGISTRATION disclosure fix.
- **Admin & user management (post-M1): DONE** — first registered user is the admin; `/admin`
  screen to change passwords, delete users, reset data (now wired to cascade deletes), grant/revoke admin,
  list users. See SPEC.md §8.7 and the Admin section below.
- **Milestone 2 (data model + migrations + seed): DONE & verified** — 10 domain models, FK
  cascade rules tested, `resetUserDataAction` + `deleteUserAction` wired to atomic ordered
  deletes (tested against full data graph), 90 system exercises seeded, `lib/units.ts` +
  Zod validation schemas for all new entities. Seed idempotent (run twice = 0 duplicates).
- **Milestone 3 (exercise library CRUD + filters + clone): DONE & verified** — `Exercise.isArchived`,
  `instructions`, `commonPitfalls` added to schema, 6 server actions (`create`, `update`, `archive`,
  `unarchive`, `delete`, `clone`), 5 UI components (`MuscleGroupPicker`, `ExerciseForm`, `ExerciseCard`,
  `ExerciseList`, `ExerciseFilters`, `ExerciseActions`), 4 pages (list/new/detail/edit), all
  Zod-validated, rate-limited (30/5min), userId-scoped, deleted exercises protected if referenced in
  workouts/sessions. Instructions (5000 char max) and common pitfalls (2000 char max) populated for all
  90 system exercises; users can add/edit both fields on custom exercises.
- **Milestone 4 (workout builder): DONE & verified** — 3 server actions (`create`, `update`, `delete`),
  6 UI components (`WorkoutCard`, `WorkoutList`, `WorkoutBuilder` with @dnd-kit drag-to-reorder,
  `WorkoutExerciseRow`, `ExercisePicker`, `WorkoutDeleteForm`), 4 pages (list/new/detail/edit), all
  Zod-validated, rate-limited (30/5min), userId-scoped. Workouts are ordered exercise lists with
  per-exercise targets (sets, reps, weight, rest, notes), superset grouping, and drag-reorderable
  exercises. Color-coded superset indicators on detail/builder views. Weight converts per user unit
  preference (kg ↔ lbs) at input/display boundaries.
- **Milestone 5 (plans/routines): DONE & verified** — 4 server actions (`create`, `update`, `setPlanStatus`, `delete`),
  5 UI components (`PlanCard`, `PlanList`, `PlanForm` with inline weekly schedule picker, `PlanDeleteForm`, `PlanStatusForm`),
  4 pages (list/new/detail/edit), all Zod-validated, rate-limited (30/5min), userId-scoped. Plans are date-ranged weekly
  schedules (Sun–Sat → workout) with status lifecycle DRAFT→ACTIVE→COMPLETED→ARCHIVED. Dashboard shows "Today's Workout"
  card when an ACTIVE plan has a workout scheduled for the current weekday.
- **Milestone 6 (live session logging): DONE & verified** — 6 server actions (`startSession`, `addExerciseToSession`, 
  `upsertSet`, `setRest`, `completeSession`, `deleteSession`), 5 UI components (`SessionCard`, `SessionLogger`, `RestTimer`, 
  `SessionCompleteForm`, `SessionDeleteForm`), 3 pages (list/new/active-detail), one-exercise-at-a-time logger with 
  drag-and-drop exercise picker reuse, rest timer countdown with skip, per-set weight/reps inputs with unit conversion, 
  RPE 1-10 effort grid + notes on completion, session summary view (read-only), all Zod-validated, rate-limited (30/5min), 
  userId-scoped. Dashboard + workout detail pages updated with "Start Session" buttons (pre-populate workout/plan/date).
- **Milestone 7 (goals + body metrics + onboarding): DONE & verified** — 4 server actions for goals (`create`, `update`, 
  `setStatus`, `delete`) + 2 for body metrics (`log`, `delete`), 1 onboarding action. 6 UI components (goal form/card/detail-actions,
  metric form/list, onboarding form). 9 pages (onboarding, metrics/list/new, goals/list/new/detail/edit). Goals support three types
  (STRENGTH via Epley 1RM estimation, BODY_METRIC with direction-aware progress, CONSISTENCY via session count), all with
  automatic progress computation; detail page has status transitions (ACHIEVED/FAILED/ARCHIVED/Reactivate) and delete. Body metrics
  logged over time with unit conversion (kg↔lbs, cm↔in); `BodyMetric` has `createdAt` for stable same-day ordering. Post-registration
  onboarding captures initial bodyweight + optional first goal in single-page flow. Dashboard shows current weight + active goals.
  All rate-limited (30/5min), userId-scoped, Zod-validated.
  **Key architectural note:** the `/onboarding` page lives in `src/app/(setup)/` (not `(app)/`) — this is intentional. The edge
  middleware (`auth.config.ts`) cannot check `onboardingComplete` reliably (JWT is stale after the action updates the DB), so the
  gate is enforced in `(app)/layout.tsx` via the Node-runtime `auth()` which re-reads from DB on every call. The `(setup)` group
  keeps the onboarding page outside the `(app)` layout to avoid a redirect loop.
- **Milestone 8 (analytics/dashboard): DONE & verified** — 5 analytics modules (`adherence`, `progression`, `prs`, `volume`, `dashboard`), 9 UI components (`StatCard`, `RecentPRs`, `AdherenceHeatmap`, `AdherenceBars`, `ProgressionChart`, `VolumeChart`, `MetricTrendChart`, `ExerciseSelector`, `MetricSelector`), full analytics page with 5 URL-param-driven tabs (Overview, Progression, Records, Volume, Body), dashboard revamped with stats row + dynamic greeting + recent PRs strip. Recharts installed. `--success`/`--warning` CSS tokens added (were missing but referenced by GoalCard). No migrations — pure computation + UI over existing data. All server-rendered; charts are `"use client"` Recharts components receiving serialised props.
- **Muscle body heatmap visualization (post-M8): DONE** — SVG front + back body views using `react-body-highlighter` (npm), displayed across 4 locations: (1) exercise detail highlighting primary/secondary muscles, (2) workout detail showing intensity by exercise count, (3) completed session showing intensity by completed sets, (4) analytics Overview tab displaying last 7 days of muscle work. Shared `BodyMap` component maps app MuscleGroup constants to library muscle strings. `getMuscleRecentVolume()` analytics function. No migrations — pure UI layer over existing data. Build passes TypeScript.
- **Milestone 9 (Docker Compose): DONE & verified** — `Dockerfile` (3-stage: deps/builder/runner on node:24-alpine), `docker-compose.yml` (single web service, named volume /data for SQLite), `.dockerignore` (excludes build artifacts + secrets), `docker/entrypoint.sh` (runs migrations + seed + next start). Host port configurable via `PORT` env var (defaults to 3000). Database path overridden to `file:/data/app.db` in container.
- **Milestone 10 (AI Foundation): DONE & verified** — Python agent sidecar (`agent_service/`) using `agent_kit` + FastAPI, streaming SSE via `POST /v1/turn`. Next.js proxy at `src/app/api/agent/route.ts` (auth-gated, rate-limited per userId, validates with Zod). Chat UI: `ChatWindow` (SSE consumer), `ChatInput` (Enter-to-send), `MessageBubble`, `ToolCallBadge`. `/chat` page replaces "More" in bottom nav; "More" reachable via link in Chat header. Docker Compose extended with `agent_service` container. 5 new env vars in `.env.example`. `python-dotenv` loads `.env` automatically in the sidecar. No tools yet (M11+).
- **Milestone 11 (Query Tools): DONE & verified** — 9 internal API routes (`src/app/api/internal/`) bridging the Python agent to Prisma data: `sessions` (with full exercise+set detail), `exercises`, `workouts`, `plans`, `goals` (with live progress via `computeGoalProgress`), `analytics/adherence`, `analytics/prs`, `analytics/progression`, `analytics/muscle-volume`. Shared `_auth.ts` helper validates `X-Internal-Secret` + `X-User-Id` headers on every route. `proxy.ts` matcher updated to exclude `api/internal` so agent requests bypass the NextAuth middleware. Python side: 8 read tools in `read_tools.py` (`get_workout_history`, `get_exercises`, `get_active_plans`, `get_goals_with_progress`, `get_personal_records`, `get_exercise_progression`, `get_adherence_stats`, `get_muscle_volume`); `service.py` switched to `AgentService.build(cfg, extra_tools=get_read_tools())`; `config.yaml` `default_allowed` updated; system prompt updated to instruct agent to use tools instead of asking the user. 37 new integration tests (274 total).
- **Milestone 12 (Coaching Intelligence): DONE & verified** — 4 synthesis tools in `agent_service/src/health_agent/tools/coaching_tools.py` that combine multiple M11 data endpoints into proactive coaching advice: `analyze_training_balance` (muscle volume + adherence → over/under-trained groups with mean+stdev classification), `assess_goal_trajectory` (goal progress + elapsed time → on-track/at-risk verdict with projected completion date), `suggest_next_workout` (active plan schedule + 2-week muscle volume + adherence → plan-aware recommendation with equipment/time constraints), `get_training_summary` (parallel gather of sessions/adherence/volume/goals/PRs → structured multi-section recap). `service.py` registers all 12 tools; `config.yaml` enriched with exercise science principles (progressive overload, periodization, muscle balance, recovery), proactive coaching persona, and 4 new `default_allowed` entries. `_LazyAsyncClient` wrapper in `client.py` defers SSL context creation to first call (fixes OPENSSL_Uplink crash on this Windows machine). Volume numbers are kg load (weight × reps), not set counts — labels updated accordingly. 20 Python tests (all pass); 274 JS tests unchanged.
- **Goal progress fix (post-M12): DONE** — body metric goals previously showed 94% on day one
  (formula used current value instead of a baseline). All goal types now store a `startingValue`
  captured at creation. Formula unified to `(current − start) / (target − start) × 100` for
  both BODY_METRIC and STRENGTH, correctly reading 0% on the first day. Direction field removed
  from BODY_METRIC goals (derived from sign of `target − start`). Form auto-populates starting
  value from latest logged metric (body metric goals) or PR (strength goals). Backward-compat
  code removed; database reset to start fresh. 278 JS tests passing.
- **Dev seed script (post-M12): DONE** — `scripts/dev-seed.ts` + `npm run db:dev-seed`. Wipes
  all user accounts (cascades to workouts/sessions/goals/metrics), then creates a fully-loaded
  demo account (`dev@health.local / password123`) with 3 workout templates (Push/Pull/Legs),
  an active PPL plan, a bodyweight goal (80 → 75 kg), 2 body metric logs, and 4 completed
  sessions with progressive overload across 2 weeks. Idempotent — safe to re-run at any time.
  Requires system exercises to be seeded first (`npm run db:seed`).
- **Pre-M13 gap fix: DONE** — `get_workouts` Python tool added to `read_tools.py` (wraps existing
  `GET /api/internal/workouts`). Returns full workout details including exercise names, IDs, sets,
  reps, weight, rest, and superset grouping for each exercise. Used to list workout templates,
  resolve names → IDs for plan scheduling, and let the agent describe workout contents. 3 new tests;
  `config.yaml` + system prompt updated. 388 JS tests passing.
- **Milestone 13 (Write Tools): DONE & verified** — 4 internal POST routes (`workouts`, `plans`,
  `goals`, `metrics`) using existing Zod schemas, rate-limited per userId (30/5min), userId-scoped,
  with cross-user workoutId guard on plan creation. 4 Python write tools in `write_tools.py`:
  `create_workout` (resolves exercise names → IDs), `create_training_plan` (resolves workout names
  → IDs, maps day names → `dayOfWeek` ints), `create_goal` (all 3 types; STRENGTH resolves
  exercise name → ID), `log_body_metric`. Write confirmation rule added to system prompt and
  `config.yaml`. 21 new JS tests + 21 new Python tests; all pass (299 JS / 44 Python).
  **Next milestone is M14 (Ad-hoc Session Logging) — see SPEC_agent.md.**
- **create_exercise tool (post-M13): DONE** — `POST /api/internal/exercises` route added (same
  auth + rate-limit + Zod pattern as other write routes). `create_exercise` Python write tool in
  `write_tools.py` (name, equipment, primary_muscles required; description, secondary_muscles,
  instructions, common_pitfalls optional). System prompt + `config.yaml` updated with explicit
  rule: only call when the user explicitly asks to create a new exercise by name; during workout
  creation, silently substitute via `get_exercises` instead of calling this tool. 12 new JS tests
  + 6 new Python tests; all pass (311 JS / 50 Python).
- **Milestone 14 (Ad-hoc Session Logging): DONE & verified** — two session write paths:
  (1) **Atomic (historical):** `POST /api/internal/sessions` — agent collects all exercises+sets,
  confirms with user, posts one completed session in a single `prisma.$transaction`
  (startedAt=endedAt=UTC midnight of the provided date, all sets `completed:true`). (2) **Live
  (start-and-hand-off):** `GET /api/internal/workouts/[id]` (new — returns template exercise list
  so agent can show/modify without touching the saved workout) + `POST /api/internal/sessions/start`
  (new — creates in-progress session with `endedAt:null`, pre-populates from explicit `exerciseIds`
  list rather than auto-expanding workoutId, enabling substitutions). Agent returns a markdown link
  `[Start logging →]({NEXTJS_BASE_URL}/sessions/{id})` — user logs sets in the app's native UI.
  Python: `log_session` + `start_session` tools in `write_tools.py`; `config.yaml` updated
  (`default_allowed` + write confirmation guidance). 40 new JS tests + 11 new Python tests; all pass
  (351 JS / 73 Python). Also fixed 3 pre-existing Python test failures in coaching tools — tests
  were patching `date.today` but the code calls `_local_now().date()`; fixed by patching
  `_local_now` directly and updating mock goal dates to future years.
- **Milestone 15 (Memory & Personalization): DONE & verified** — factual memory activated: `profile_backend` +
  `permission_backend` switched to SQLite in `config.yaml`, `extraction_enabled: true` with fitness-focused
  extraction prompt (injuries, equipment, schedule, motivation). Memory & personalization section added to system
  prompt — agent proactively stores durable facts via `remember_fact`; stored facts auto-injected into every turn's
  system prompt by agent_kit (no explicit `list_facts` call needed). New `GET /v1/user-facts` endpoint on the
  Python sidecar (auth: `X-Internal-Secret` + `X-User-Id`). New `AiInsightsCard` server component on `/dashboard`
  (renders up to 3 stored facts; hidden when empty; graceful if sidecar unavailable). `getAiInsights(userId)` utility
  at `src/lib/ai-insights.ts` — server-side fetch to sidecar with 60s cache, returns null on any failure.
  Docker Compose updated: `agent_service` mounts shared `/data` volume, `SQLITE_URL` points to `/data/agent_kit.db`.
  `.env.example` documents `SQLITE_URL`, `VECTOR_BACKEND`, `QDRANT_MODE`, `QDRANT_PATH`. 6 new Python tests; 378 JS
  tests unchanged. Build clean.
  **Episodic memory (cross-conversation recall) is opt-in:** set `VECTOR_BACKEND=qdrant` + run LM Studio embedding
  server. Factual memory works out of the box without it.
- Remaining domain sections still render `<ComingSoon milestone="…" />` placeholder.

## Stack (note the versions — several have breaking changes vs. older training data)

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript, `src/` dir, `@/*` → `src/*`
- **Prisma 7** over **SQLite** via the **`better-sqlite3` driver adapter**
- **Auth.js / NextAuth v5 (beta)** — Credentials, JWT sessions, `bcryptjs`
- **Tailwind v4** (CSS-config in `globals.css`, no `tailwind.config`), **Zod 4**, **lucide-react**
- **Recharts** (interactive charts) + **react-body-highlighter** (SVG muscle body visualization)

## Environment gotchas (important — these cost time if forgotten)

1. **Corporate root CA on this machine.** npm/font/registry TLS fails unless Node trusts the
   Windows cert store. Prefix install/build commands: `export NODE_OPTIONS=--use-system-ca`.
   (Not needed inside Docker — clean image hits the real registry.)
2. **Node is 24.17.0 LTS** via nvm-windows (`nvm use 24.17.0` if a shell shows old version).
3. **SQLite + Prisma has NO native enums and NO scalar-list/array columns.** "Enum" fields are
   `String` columns validated by Zod (see `src/lib/constants.ts` + `src/lib/validation/`).
   Muscle-group arrays etc. become JSON or join tables (Milestone 2).
4. **Prisma 7 needs a driver adapter** — never `new PrismaClient()` bare. Use the shared
   singleton in `src/lib/db.ts` (wires `PrismaBetterSqlite3` from `DATABASE_URL`).
5. **Next 16 renamed `middleware` → `proxy`.** Route protection lives in `src/proxy.ts`; its
   handler must be a default export or named `proxy` function (object-destructure exports are
   rejected by Next's static analyzer).
6. **Auth.js self-hosting** needs `trustHost: true` (set in `src/auth.config.ts`) or it throws
   `UntrustedHost`.

## Commands

```bash
export NODE_OPTIONS=--use-system-ca   # this machine only, before npm install/build
npm run dev            # dev server (http://localhost:3000)
npm run build          # type-check + production build
npm run lint
npm run db:migrate     # prisma migrate dev (create + apply migration)
npm run db:deploy      # prisma migrate deploy (apply existing; first run)
npm run db:seed        # seed 90 system exercises (idempotent)
npm run db:dev-seed    # wipe all users + create demo account with sample data (dev only)
npm run db:studio

# Tests (run these before and after every change to catch regressions)
npm run test               # all 351 tests (~7s)
npm run test:unit          # unit + validation + analytics only (~2s, no DB)
npm run test:integration   # server action + scenario tests (~5s, in-memory DB)
npm run test:watch         # re-run on file changes during development
npm run test:coverage      # generates coverage/index.html

# Agent sidecar (Milestone 10+) — run from agent_service/ in a separate terminal
cd agent_service
uv sync                    # install Python deps (first run or after pyproject.toml changes)
uv run uvicorn health_agent.main:app --reload --port 8000
```

After editing `prisma/schema.prisma`: run a migration, then `npx prisma generate`
(migrate does NOT auto-generate the client here). Client outputs to `src/generated/prisma/`
(gitignored) — import from `@/generated/prisma/client`.

## Auth architecture (split for edge vs. node)

- `src/auth.config.ts` — **edge-safe** (no DB/bcrypt): `pages`, `session`, `trustHost`,
  `authorized` (route guard; also gates `/admin/*` on `isAdmin`), `jwt`/`session` callbacks
  (carry `id` + `unitPreference` + `isAdmin`).
- `src/auth.ts` — full config: Credentials provider with Prisma + bcrypt `authorize`.
  Exports `handlers`, `auth`, `signIn`, `signOut`.
- `src/proxy.ts` — middleware/route protection (imports only `auth.config`).
- `src/app/api/auth/[...nextauth]/route.ts` — re-exports `handlers`.
- `src/types/next-auth.d.ts` — module augmentation. NOTE: augment **`@auth/core/jwt`** for the
  JWT type (augmenting `next-auth/jwt` does NOT merge, it only re-exports).
- Server actions: `src/lib/actions/auth.ts` (`registerAction`, `loginAction`, `signOutAction`).

## Admin (first-user-is-admin)

The **first registered user** becomes admin — `registerAction` sets `isAdmin: true` inside a
`prisma.$transaction` when `user.count() === 0`. `isAdmin` rides the JWT/session like
`unitPreference`. Admin server actions live in `src/lib/actions/admin.ts`
(`changeUserPasswordAction`, `deleteUserAction`, `resetUserDataAction`, `setUserRoleAction`),
schemas in `src/lib/validation/admin.ts`, UI under `src/app/(app)/admin/` +
`src/components/admin/`. SPEC.md §8.7 is the full spec. Rules when touching admin code:

- **Re-check `isAdmin` from the DB, never trust the JWT alone.** Use the `requireAdmin()` helper
  — the JWT can be stale up to 30 days after a demotion (the known non-revocability tradeoff).
  The proxy/page guards on `isAdmin` are convenience only; the action boundary is the real gate.
- **Destructive actions require the admin's password** (`bcrypt.compare`) — change-password,
  delete, reset-data.
- **Guardrails:** never let an admin delete their own account, and never demote the **last**
  admin (count before revoking). These prevent a permanent lock-out.
- `resetUserDataAction` + `deleteUserAction` use a shared `userDataDeletions()` helper that
  atomically wipes all domain rows (10 scoped `deleteMany` calls) in FK-safe order so
  `onDelete: Restrict` rules never trip. User account is preserved on reset, deleted on user delete.

## Layout

```
src/
  app/
    (auth)/  login, register        # public, centered-card layout
    (setup)/ onboarding             # logged-in but pre-onboarding; no nav bar (see M7 note above)
    (app)/   dashboard, exercises, workouts, plans, sessions, metrics,
             goals, analytics, more, profile, admin   # authed shell (header + BottomNav)
    api/auth/[...nextauth]/route.ts
    api/agent/route.ts             # SSE proxy to Python sidecar (auth-gated)
    api/internal/                  # internal data bridge (M11+) — secret-gated, not NextAuth
      _auth.ts                     # shared X-Internal-Secret + X-User-Id validator
      sessions/ exercises/ workouts/ plans/ goals/ metrics/route.ts
      sessions/start/route.ts      # POST: create in-progress session (M14)
      workouts/[id]/route.ts       # GET: single workout with exercises (M14)
      analytics/ adherence/ prs/ progression/ muscle-volume/route.ts
      # workouts, plans, goals, exercises also have POST handlers (M13+)
    page.tsx                       # redirects -> /dashboard
  components/  auth/, admin/, ui/ (body-map), app-shell/ (header, bottom-nav, page-header, coming-soon),
               analytics/ (stat-card, recent-prs, heatmap, bars, charts, selectors, tab-nav, muscle-map-overview)
               chat/ (ChatWindow, ChatInput, MessageBubble, ToolCallBadge)
  lib/  db.ts, constants.ts, units.ts, actions/ (auth, admin), validation/ (auth, admin,
        exercise, workout, plan, session, body-metric, goal),
        analytics/ (goals, adherence, progression, prs, volume, dashboard, muscle-recent)
  generated/prisma/                # generated client (gitignored)
prisma/  schema.prisma, migrations/, seed.ts
agent_service/                     # Python sidecar (M10+)
  config.yaml                      # agent_kit config (LLM, memory, tools)
  src/health_agent/
    main.py service.py             # FastAPI + AgentService bootstrap
    tools/ client.py read_tools.py coaching_tools.py write_tools.py  # httpx client + 9 read tools (M11+pre-M13) + 4 coaching tools (M12) + 8 write tools (M13+M14)
```

## Tests

**Always run `npm run test` before committing and after any non-trivial change.** All 351 tests must pass; a red suite blocks merging. The tests are fast (~7s total) so there's no reason to skip them.

### Structure

```
src/__tests__/
  setup.ts                        # global mocks (auth, next/navigation, next/cache, @/lib/db)
  helpers/db.ts                   # createTestDb(), seedTestUser(), seedTestExercise()
  unit/
    units.test.ts                 # toKg/fromKg/toCm/fromCm round-trips
    validation/                   # one file per schema in src/lib/validation/
  analytics/                      # one file per module in src/lib/analytics/
  integration/
    actions/                      # one file per action file in src/lib/actions/
    scenarios/                    # multi-step user journeys (no browser)
```

### What each layer covers
- **Unit** — pure functions: `lib/units.ts` and all Zod schemas. No DB, no mocks needed.
- **Analytics** — `lib/analytics/*` functions. Each function accepts `prisma` as a param, so tests pass lightweight stubs; no DB.
- **Integration (actions)** — every server action tested against a real in-memory SQLite DB (migrations applied). Mocks only Next.js internals (`auth`, `redirect`, `revalidatePath`). Each test file gets its own isolated temp DB via `createTestDb()`.
- **Integration (scenarios)** — multi-action journeys that call server actions in sequence (e.g. create exercise → build workout → start session → log sets → complete → check analytics). Catch regressions that unit tests miss.

### Rules for new development
1. **New server action** → add a test file in `src/__tests__/integration/actions/`. Cover: unauthenticated call returns error, happy path writes to DB, cross-user access returns generic "not found".
2. **New Zod schema** → add cases in the matching `src/__tests__/unit/validation/` file (valid input passes, required fields missing fail, invalid enum values fail).
3. **New analytics function** → add a test in `src/__tests__/analytics/` passing a stub prisma object.
4. **New migration** → add the filename to the `MIGRATIONS` array in `src/__tests__/helpers/db.ts` or integration tests will fail with schema mismatches.
5. **New user journey** → consider adding a scenario test in `src/__tests__/integration/scenarios/`.

### Test infra gotchas
- `vi.mock("@/lib/db")` uses a `get prisma()` getter (not a static value) because `vi.mock` is hoisted before `beforeAll`. The getter reads `(globalThis as any).__testDb` which each integration test sets in `beforeAll`.
- `redirect()` is mocked as `vi.fn()` — it does **not** throw. Actions that call `redirect` on success return `undefined`. Assert DB state instead of `result.success` for those actions.
- `setRestAction(setId, seconds)` is positional (two args), not an object — matches the source signature.
- `getPersonalRecords` requires ≥ 2 completed sessions per exercise before returning PRs.
- `pool: "forks"` in `vitest.config.ts` is mandatory — prevents the Prisma singleton in `db.ts` from leaking between test files.

## Conventions

- Weights stored canonically in **kg**, lengths in **cm**; convert at display only.
- All data scoped per `userId`; system/seed exercises are the only shared rows.
- Zod-validate every server action input; reuse schemas client + server.

### Dates & timestamps

- **All `DateTime` columns stored as UTC** in SQLite. Date-only fields (plan `startDate`/`endDate`,
  goal `targetDate`, session `date`) are stored as **UTC midnight** — e.g. `new Date("2026-06-24")`
  produces `2026-06-24T00:00:00.000Z`.
- **Display** — `formatDateOnly()` in `src/lib/dates.ts` reconstructs a local-timezone Date from
  the UTC-midnight value so `"June 24"` always renders correctly regardless of the viewer's timezone.
  Never rely on `.toLocaleDateString()` directly on a raw Prisma DateTime.
- **User timezone** — each user has a `timezone` field (IANA string, e.g. `"America/New_York"`).
  The Next.js agent proxy injects `X-User-Timezone` on every request to the Python sidecar. The
  sidecar stores it in a `user_timezone` ContextVar (`health_agent/context.py`) for the duration
  of that turn.
- **Agent timezone awareness** — `_system_prompt_fn` in `service.py` reads `user_timezone` and
  injects *"Today's date is Wednesday, 2026-06-25. User's timezone: America/New_York."* at the top
  of every system prompt. `_today_str()` in `write_tools.py` reads the same ContextVar to compute
  today's date in the user's local timezone (used as default for `date` params).
- **Python coaching tools** use `_local_now()` (in `coaching_tools.py`) — returns `datetime.now(tz)`
  for the user's timezone. **Do not mock `date.today` in tests for these tools** — it is never
  called. Mock `health_agent.tools.coaching_tools._local_now` instead, returning a `datetime`
  object: `mock_now.return_value = datetime(2027, 7, 1, 12, 0)`.
- **Agent date rule** — when the user says "yesterday" or a weekday name, the agent interprets it
  in the user's local timezone (already injected). Write tools accept `YYYY-MM-DD` strings and
  store them as UTC midnight; no conversion needed at the tool boundary.

## Security

**No shortcuts, even for personal deployments.** Every milestone must follow the rules below.

### What is already in place
- **HTTP security headers** — `next.config.ts` sets CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, HSTS, `Referrer-Policy`, and `Permissions-Policy` on all routes.
  CSP uses `'unsafe-inline'` for `script-src` (required by Next.js inline hydration scripts);
  nonce-based strict CSP is the correct upgrade path (see Deferred below). **In dev only**,
  `script-src` also includes `'unsafe-eval'` — React's dev build uses `eval()` for debugging,
  and strict browsers (**Firefox** especially; Chromium is lenient) otherwise block React's dev
  runtime so nothing hydrates (native `<form>` POSTs still work, masking it). Production never
  uses eval and stays strict (gated on `NODE_ENV` in `next.config.ts`).
- **Rate limiting** — in-process sliding-window limiter in `src/lib/rate-limit.ts`.
  Login: 10 attempts/IP/15 min. Register: 5/IP/hr. Skips cleanly when IP is unavailable
  (local dev without a reverse proxy). Apply to any new sensitive action — use `checkRateLimit`.
- **bcrypt cost 12** — password max capped at 72 chars in `registerSchema` (bcrypt's
  silent truncation limit). Login schema has no max so existing longer passwords still verify.
- **Email enumeration protection** — duplicate-email error on registration is generic.
- **Scoped Prisma selects** — `authorize()` explicitly selects only needed columns;
  `passwordHash` is never accidentally returned to the client.
- **CSRF** — covered by Next.js App Router (Origin-header check on all server actions).
- **SQL injection** — not possible; Prisma uses parameterised queries exclusively.

### Mandatory rules for every new server action
1. **Auth first** — call `auth()`, assert `session?.user?.id` exists; return early if not.
   Never accept `userId` from the request body or query string.
2. **Zod-validate all inputs** — define schemas in `src/lib/validation/`; reuse on client and
   server. No raw `formData.get()` value touches the DB.
3. **Scope every query to `userId`** — `where: { userId, id }`, never `where: { id }` alone.
4. **Explicit `select` on Prisma calls** — only return fields the caller needs. Future schema
   additions (sensitive columns, relations) must not be silently included.
5. **Rate-limit sensitive or high-volume actions** — any action that writes data, performs
   expensive computation, or could be used to probe for data should call `checkRateLimit`.
6. **Generic errors at resource boundaries** — "not found" and "forbidden" must be
   indistinguishable to the client. Never confirm whether a record exists to an
   unauthenticated or unauthorised caller.
7. **No secrets in client components** — never import `src/auth.ts`, `src/lib/db.ts`, or
   any server-only module inside a `"use client"` file.

### Deferred (known limitations, accepted for v1)
- **JWT session non-revocability** — sign-out deletes the cookie but the JWT remains valid
  until expiry (default 30 days). A DB session table or token blocklist would fix this but
  contradicts the SQLite-only model. Revisit if threat model changes.
- **Nonce-based strict CSP** — `'unsafe-inline'` in `script-src` is a concession to Next.js
  hydration. The upgrade path: inject a nonce in `src/proxy.ts` and pass it to all `<Script>`
  tags; remove `'unsafe-inline'` once wired up.
