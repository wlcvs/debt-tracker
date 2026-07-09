#!/usr/bin/env bash
# Boots Postgres + the Next.js dev server, logs in as the admin user via
# the real Auth.js credentials flow, and confirms the authenticated
# dashboard renders. Run from anywhere; paths are resolved relative to
# this script.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

LOG=/tmp/debt-tracker-dev.log
PIDFILE=/tmp/debt-tracker-dev.pid
COOKIES=$(mktemp)

if [ ! -f .env ]; then
  echo "FAIL: .env not found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

port_open() { (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null && { exec 3>&-; return 0; }; return 1; }

if port_open; then
  echo "==> Postgres already listening on :5432, reusing it"
else
  echo "==> Starting Postgres (docker compose)"
  docker compose up -d
  echo "==> Waiting for Postgres on :5432"
  for i in $(seq 1 30); do
    port_open && break
    sleep 1
  done
fi

echo "==> Applying migrations + generating client"
npx prisma migrate deploy
npx prisma generate

if curl -sf http://localhost:3000/login >/dev/null 2>&1; then
  echo "==> Dev server already running on :3000, reusing it"
else
  echo "==> Starting dev server"
  nohup npm run dev > "$LOG" 2>&1 &
  echo $! > "$PIDFILE"

  echo "==> Waiting for http://localhost:3000/login"
  for i in $(seq 1 60); do
    curl -sf http://localhost:3000/login >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "==> Logging in as ${ADMIN_EMAIL}"
CSRF=$(curl -s -c "$COOKIES" http://localhost:3000/api/auth/csrf | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
# Provider id is "admin" (see src/auth.ts Credentials({ id: "admin" })), NOT "credentials".
curl -s -b "$COOKIES" -c "$COOKIES" -X POST http://localhost:3000/api/auth/callback/admin \
  --data-urlencode "email=${ADMIN_EMAIL}" \
  --data-urlencode "password=${ADMIN_PASSWORD}" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=http://localhost:3000/" \
  --data-urlencode "json=true" \
  -o /dev/null

echo "==> Verifying authenticated dashboard"
BODY=$(curl -s -b "$COOKIES" http://localhost:3000/)
rm -f "$COOKIES"

if echo "$BODY" | grep -q "Devedores"; then
  echo "PASS: logged in and dashboard rendered authenticated content"
else
  echo "FAIL: dashboard did not render expected content after login"
  exit 1
fi

if [ -f "$PIDFILE" ]; then
  echo "Dev server PID: $(cat "$PIDFILE") — log: $LOG"
  echo "Stop with: kill \$(cat $PIDFILE)"
fi
