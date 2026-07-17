---
name: run-debt-tracker
description: Start, drive, and verify debt-tracker (Next.js debt tracker app) on a machine that's already set up. Use when asked to start the app, run it locally, run its tests, or verify a change actually works end-to-end (login + dashboard). If setup has never been done on this machine (no .env, DB never migrated/seeded, Docker not installed), use the setup-debt-tracker skill first.
---

This is a Next.js 16 app (Postgres + Prisma + Auth.js). Assumes
`setup-debt-tracker` has already been run once (`.env` exists, deps
installed, DB migrated and seeded). Drive it via
`.claude/skills/run-debt-tracker/smoke.sh` — it boots Postgres, starts
the dev server, logs in as the admin user through the real Auth.js
credentials flow (`curl`, no browser needed), and confirms the
authenticated dashboard renders.

All paths below are relative to the repo root.

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

This confirms the app boots and admin auth works, but it's a `curl`
check, not a browser — it does not verify visual/CSS changes. For
those, ask the user to eyeball the running dev server themselves (or
use a real browser-driving tool if one is available in the session).

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

- **The credentials provider's callback URL is `/api/auth/callback/admin`,
  not `/api/auth/callback/credentials`.** `src/auth.ts` registers the
  provider with `Credentials({ id: "admin", ... })`. Posting to the
  generic `.../credentials` path 302s to
  `/api/auth/error?error=Configuration` with a `Provider with id
  "credentials" not found` error in the server log — easy to miss
  since it still returns a 302 like a real success would.
- **Docker group membership doesn't apply to already-open shells**
  (including this agent's Bash sessions) — `usermod -aG docker` only
  takes effect in new login sessions. `smoke.sh` works around this by
  checking if port `5432`/`3000` is already open before touching
  docker/npm, so once Postgres and the dev server are up, the script
  no longer needs docker permissions at all. If it genuinely needs to
  start Postgres and gets `permission denied while trying to connect
  to the docker API`, ask the user to run `docker compose up -d`
  themselves (or `newgrp docker` / re-login) — or run `setup-debt-tracker`.

## Troubleshooting

- **`Error: Provider with id "credentials" not found. Available
  providers: [admin].`** in the dev server log: you posted to the
  wrong callback path — use `/api/auth/callback/admin` (see Gotchas).
- **`permission denied while trying to connect to the docker API`**:
  current shell predates the `usermod -aG docker` change. Either have
  the user run the docker command directly, or open a fresh login
  session.
- **Missing `.env`, DB never migrated, or no admin user**: this is a
  setup problem, not a run problem — use the `setup-debt-tracker` skill.
