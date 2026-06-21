@AGENTS.md

# Health — Workout Programming App

Self-hostable, mobile-first web app to program & follow exercise routines toward a
health goal. **Read [SPEC.md](./SPEC.md) for the full architecture and the milestone
roadmap (§11).** This file is the quick-start; SPEC.md is the source of truth.

## Status

- **Milestone 1 (scaffold + auth + app shell): DONE & verified** (lint + build + HTTP login flow).
- **Security hardening (post-M1): DONE** — headers, rate limiting, email-enumeration fix,
  bcrypt cap, select scoping, password confirmation, ALLOW_REGISTRATION disclosure fix.
- Next up: **Milestone 2** — full data model (exercises, workouts, plans, sessions,
  goals, metrics) + seeded exercise library.
- All domain sections currently render a `<ComingSoon milestone="…" />` placeholder.

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
  `authorized` (route guard), `jwt`/`session` callbacks (carry `id` + `unitPreference`).
- `src/auth.ts` — full config: Credentials provider with Prisma + bcrypt `authorize`.
  Exports `handlers`, `auth`, `signIn`, `signOut`.
- `src/proxy.ts` — middleware/route protection (imports only `auth.config`).
- `src/app/api/auth/[...nextauth]/route.ts` — re-exports `handlers`.
- `src/types/next-auth.d.ts` — module augmentation. NOTE: augment **`@auth/core/jwt`** for the
  JWT type (augmenting `next-auth/jwt` does NOT merge, it only re-exports).
- Server actions: `src/lib/actions/auth.ts` (`registerAction`, `loginAction`, `signOutAction`).

## Layout

```
src/
  app/
    (auth)/ login, register        # public, centered-card layout
    (app)/  dashboard, exercises, workouts, plans, sessions, metrics,
            goals, analytics, more, profile   # authed shell (header + BottomNav)
    api/auth/[...nextauth]/route.ts
    page.tsx                       # redirects -> /dashboard
  components/  auth/, ui/, app-shell/ (header, bottom-nav, page-header, coming-soon)
  lib/  db.ts, constants.ts, actions/, validation/
  generated/prisma/                # generated client (gitignored)
prisma/  schema.prisma, migrations/
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
  nonce-based strict CSP is the correct upgrade path (see Deferred below).
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
