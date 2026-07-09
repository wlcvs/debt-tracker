---
name: run-debt-tracker
description: Build, run, and drive debt-tracker (Next.js debt tracker app). Use when asked to start the app, run it locally, run its tests, or verify a change actually works end-to-end (login + dashboard).
---

This is a Next.js 16 app (Postgres + Prisma + Auth.js). Drive it via
`.claude/skills/run-debt-tracker/smoke.sh` — it boots Postgres, starts
the dev server, logs in as the admin user through the real Auth.js
credentials flow (`curl`, no browser needed), and confirms the
authenticated dashboard renders.

All paths below are relative to the repo root.

## Prerequisites

Docker is required for local Postgres (no docker/postgresql found
preinstalled on this box).

```bash
sudo pacman -S --needed docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"   # then log out/in (or `newgrp docker`) for it to take effect
```

(Ubuntu/Debian equivalent: `sudo apt-get install -y docker.io docker-compose-plugin`.)

## Setup

```bash
cp .env.example .env
```

Fill in `.env`:

```bash
DATABASE_URL="postgresql://debt_tracker:debt_tracker_dev@localhost:5432/debt_tracker_next"   # matches docker-compose.yml
ADMIN_EMAIL="test@example.com"
ADMIN_PASSWORD="teste1234"
AUTH_SECRET="$(openssl rand -base64 33)"    # see Gotchas — npx auth secret no longer works
NEXT_PUBLIC_APP_URL="http://localhost:3000"
LLM_BASE_URL=   # leave empty — no LLM extraction server in dev, algorithmic import still works
```

```bash
npm install
docker compose up -d                              # start Postgres
npx prisma migrate deploy && npx prisma generate   # schema + client
node --env-file=.env --import tsx/esm prisma/seed.ts   # creates the admin user
```

## Run (agent path)

```bash
.claude/skills/run-debt-tracker/smoke.sh
```

What it does: starts Postgres if not already listening on `:5432`,
applies migrations, starts `npm run dev` in the background (skips this
if something's already answering on `:3000`), then performs the actual
Auth.js credentials login (`GET /api/auth/csrf` → `POST
/api/auth/callback/admin` with the CSRF token and cookie jar) and
`GET`s `/` to confirm the authenticated dashboard renders (`Devedores`
appears in the body — public/login pages never show that).

Output ends with `PASS: logged in and dashboard rendered authenticated
content` or `FAIL: ...` (exit 1). Dev server log: `/tmp/debt-tracker-dev.log`.
PID file: `/tmp/debt-tracker-dev.pid`.

Stop the dev server with:

```bash
kill $(cat /tmp/debt-tracker-dev.pid)
```

Postgres is left running (`docker compose down` to stop it).

## Run (human path)

```bash
npm run dev
```

Opens on `http://localhost:3000`. Ctrl-C to stop. Log in at `/login`
with the `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env`.

## Test

```bash
npm run test:run
```

Vitest, Prisma fully mocked — no DB needed for this command.

---

## Gotchas

- **`npx auth secret` is broken as a way to generate `AUTH_SECRET`.**
  The npm package name `auth` now belongs to the *Better Auth* CLI
  (`better-auth.com`), an unrelated project — running it installs
  `auth@1.x` and prints a `BETTER_AUTH_SECRET` line, not an Auth.js
  secret. Generate one with `openssl rand -base64 33` instead.
- **The credentials provider's callback URL is `/api/auth/callback/admin`,
  not `/api/auth/callback/credentials`.** `src/auth.ts` registers the
  provider with `Credentials({ id: "admin", ... })`. Posting to the
  generic `.../credentials` path 302s to
  `/api/auth/error?error=Configuration` with a `Provider with id
  "credentials" not found` error in the server log — easy to miss
  since it still returns a 302 like a real success would.
- **`npx tsx prisma/seed.ts` alone fails** with `ADMIN_EMAIL and
  ADMIN_PASSWORD must be set in .env` — the script doesn't load
  dotenv itself. Use the command in CLAUDE.md /  Setup above:
  `node --env-file=.env --import tsx/esm prisma/seed.ts`.
- **Docker group membership doesn't apply to already-open shells**
  (including this agent's Bash sessions) — `usermod -aG docker` only
  takes effect in new login sessions. `smoke.sh` works around this by
  checking if port `5432`/`3000` is already open before touching
  docker/npm, so once Postgres and the dev server are up, the script
  no longer needs docker permissions at all. If it genuinely needs to
  start Postgres and gets `permission denied while trying to connect
  to the docker API`, ask the user to run `docker compose up -d`
  themselves (or `newgrp docker` / re-login).

## Troubleshooting

- **`Error: Provider with id "credentials" not found. Available
  providers: [admin].`** in the dev server log: you posted to the
  wrong callback path — use `/api/auth/callback/admin` (see Gotchas).
- **`permission denied while trying to connect to the docker API`**:
  current shell predates the `usermod -aG docker` change. Either have
  the user run the docker command directly, or open a fresh login
  session.
- **`ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env`** from the
  seed script: you ran `npx tsx prisma/seed.ts` directly instead of
  the `--env-file=.env` form (see Gotchas).
