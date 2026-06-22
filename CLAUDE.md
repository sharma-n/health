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
  deletes (tested against full data graph), 37 system exercises seeded, `lib/units.ts` +
  Zod validation schemas for all new entities. Seed idempotent (run twice = 0 duplicates).
- **Milestone 3 (exercise library CRUD + filters + clone): DONE & verified** — `Exercise.isArchived`,
  `instructions`, `commonPitfalls` added to schema, 6 server actions (`create`, `update`, `archive`,
  `unarchive`, `delete`, `clone`), 5 UI components (`MuscleGroupPicker`, `ExerciseForm`, `ExerciseCard`,
  `ExerciseList`, `ExerciseFilters`, `ExerciseActions`), 4 pages (list/new/detail/edit), all
  Zod-validated, rate-limited (30/5min), userId-scoped, deleted exercises protected if referenced in
  workouts/sessions. Instructions (5000 char max) and common pitfalls (2000 char max) populated for all
  37 system exercises; users can add/edit both fields on custom exercises.
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
- Next up: **Milestone 8** — analytics/dashboard (progression charts, PRs, adherence, muscle volume, home feed).
- Remaining domain sections still render `<ComingSoon milestone="…" />` placeholder.

## Stack (note the versions — several have breaking changes vs. older training data)

- **Next.js 16** (App Router, Turbopack) + **React 19** + TypeScript, `src/` dir, `@/*` → `src/*`
- **Prisma 7** over **SQLite** via the **`better-sqlite3` driver adapter**
- **Auth.js / NextAuth v5 (beta)** — Credentials, JWT sessions, `bcryptjs`
- **Tailwind v4** (CSS-config in `globals.css`, no `tailwind.config`), **Zod 4**, **lucide-react**

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
npm run db:studio
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
    page.tsx                       # redirects -> /dashboard
  components/  auth/, admin/, ui/, app-shell/ (header, bottom-nav, page-header, coming-soon)
  lib/  db.ts, constants.ts, units.ts, actions/ (auth, admin), validation/ (auth, admin,
        exercise, workout, plan, session, body-metric, goal)
  generated/prisma/                # generated client (gitignored)
prisma/  schema.prisma, migrations/, seed.ts
```

## Conventions

- Weights stored canonically in **kg**, lengths in **cm**; convert at display only.
- All data scoped per `userId`; system/seed exercises are the only shared rows.
- Zod-validate every server action input; reuse schemas client + server.

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
