# Health — Workout Programming App

A self-hostable, mobile-first web app to **program and follow exercise routines
toward a health goal**. Build exercises → compose workouts → schedule them into
dated plans → log live sessions → track progress.

See [SPEC.md](./SPEC.md) for the full architecture and roadmap.

## Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Prisma 7** over **SQLite** (via the `better-sqlite3` driver adapter)
- **Auth.js (NextAuth v5)** — email/password, JWT sessions, bcrypt hashing
- **Tailwind CSS v4**, **Zod** validation, **lucide-react** icons

## Prerequisites

- Node.js 24 LTS (or newer)

## Local development

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your env file and set a secret
cp .env.example .env
#    then set AUTH_SECRET, e.g.:
#    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Apply database migrations (creates ./dev.db)
npm run db:deploy

# 4. Run the dev server
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to **/login**; create an
account from there (open sign-up is on by default — set `ALLOW_REGISTRATION=false`
to disable it once your accounts exist).

## Scripts

| Script             | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the dev server                           |
| `npm run build`    | Production build (type-check + compile)        |
| `npm start`        | Run the production build                       |
| `npm run lint`     | ESLint                                         |
| `npm run db:migrate` | Create + apply a migration (dev)             |
| `npm run db:deploy`  | Apply existing migrations (prod/first run)    |
| `npm run db:studio`  | Open Prisma Studio                            |

## Environment variables

See [.env.example](./.env.example). Key vars: `DATABASE_URL`, `AUTH_SECRET`
(required), `ALLOW_REGISTRATION`, `PORT`.

## Roadmap

Built milestone-by-milestone per [SPEC.md §11](./SPEC.md). **Milestone 1
(scaffold + auth + app shell)** is complete; remaining sections show a
"coming soon" placeholder until their milestone lands.

> Docker Compose packaging arrives in Milestone 9.
