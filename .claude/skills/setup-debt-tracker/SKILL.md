---
name: setup-debt-tracker
description: One-time environment setup for debt-tracker (Next.js debt tracker app) — installing Docker/Postgres, creating .env, installing deps, running migrations, and seeding the admin user. Use when the project has never been run on this machine, or when setup itself is broken (missing .env, DB not migrated, no admin user). For actually starting/driving an already-set-up project, use the run-debt-tracker skill instead.
---

This is a Next.js 16 app (Postgres + Prisma + Auth.js). This skill only
covers getting a fresh checkout into a runnable state. Once setup is
done, use the `run-debt-tracker` skill to start and drive the app.

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

Once this succeeds, hand off to the `run-debt-tracker` skill to start
the dev server and verify it works end-to-end.

---

## Gotchas

- **`npx auth secret` is broken as a way to generate `AUTH_SECRET`.**
  The npm package name `auth` now belongs to the *Better Auth* CLI
  (`better-auth.com`), an unrelated project — running it installs
  `auth@1.x` and prints a `BETTER_AUTH_SECRET` line, not an Auth.js
  secret. Generate one with `openssl rand -base64 33` instead.
- **`npx tsx prisma/seed.ts` alone fails** with `ADMIN_EMAIL and
  ADMIN_PASSWORD must be set in .env` — the script doesn't load
  dotenv itself. Use the command above:
  `node --env-file=.env --import tsx/esm prisma/seed.ts`.
- **Docker group membership doesn't apply to already-open shells**
  (including this agent's Bash sessions) — `usermod -aG docker` only
  takes effect in new login sessions. If `docker compose up -d` fails
  with `permission denied while trying to connect to the docker API`,
  ask the user to run it themselves (or `newgrp docker` / re-login).

## Troubleshooting

- **`permission denied while trying to connect to the docker API`**:
  current shell predates the `usermod -aG docker` change. Either have
  the user run the docker command directly, or open a fresh login
  session.
- **`ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env`** from the
  seed script: you ran `npx tsx prisma/seed.ts` directly instead of
  the `--env-file=.env` form (see Gotchas).
