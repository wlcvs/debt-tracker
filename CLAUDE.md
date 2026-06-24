# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app does

Personal debt tracker where the admin (Wallacy) logs debts and payments for people who owe him. Each person (debtor) gets an `accessCode` for a read-only public view. Debtors can also register/login at `/debtor/*` for a richer view.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (TypeScript, App Router, Server Actions) |
| Database | PostgreSQL — Docker locally / Neon in production |
| ORM | Prisma 7 (client generated at `src/generated/prisma`) |
| Auth | Auth.js v5 (next-auth) — Credentials provider + JWT session |
| Styles | Tailwind CSS 4 |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Email | Resend — domain `wlcsv.dev`, sender `noreply@wlcsv.dev` |
| Validation | Zod |

## Commands

```bash
# Dev
npm run dev

# Build
npm run build

# Lint
npm run lint

# Unit tests (Vitest, no DB, Prisma mocked)
npm run test:run          # single run
npm run test              # watch mode

# E2E tests (Playwright — starts dev server automatically)
npm run test:e2e
npm run test:e2e:ui       # with Playwright UI

# DB
docker compose up -d                  # start Postgres locally
npx prisma migrate dev                # run migrations + regenerate client
npx prisma generate                   # regenerate client only
npx tsx prisma/seed.ts                # create admin user (ADMIN_EMAIL + ADMIN_PASSWORD)
```

Prisma client is generated into `src/generated/prisma` — always run `npx prisma generate` after schema changes.

## Architecture

### Route structure

```
src/app/
  (dashboard)/          # admin-only; protected by Edge middleware (proxy.ts)
    page.tsx            # dashboard with stats
    person/[id]/        # debtor detail view
  public/[code]/        # debtor read-only view, no login required
  debtor/login|register # debtor authentication
  login/                # admin login
  forgot-password/
  reset-password/[token]/
  account/
  api/
    auth/[...nextauth]/
    notifications/      # fire-and-forget webhook; authenticated via NOTIFICATIONS_SECRET header
```

### Server Actions

All mutations go through Server Actions in `src/lib/actions/`:
- `person.ts` — CRUD for debtors
- `debt.ts` — add/edit/delete debts
- `payment.ts` — add/edit/delete payments
- `credit-card.ts` — admin's credit cards (referenced in debts)
- `auth.ts` — admin login/logout
- `debtor-auth.ts` — debtor login/register
- `password-reset.ts` — forgot/reset password flow

### Auth

Two separate sessions:
- **Admin** — Auth.js v5 Credentials, JWT, role `admin` injected in `auth.config.ts`. Edge middleware (`proxy.ts`) reads this to protect `(dashboard)` routes.
- **Debtor** — separate session at `/debtor/*`.
- **Public** — `/public/[code]` requires no login; just the `accessCode`.

`auth.config.ts` is intentionally split from `auth.ts` so it can be imported in the Edge runtime.

### Prisma models

```
User               — admin; owns People and CreditCards
Person             — debtor; name, email?, passwordHash?, phone?, emailNotifications, accessCode (unique)
CreditCard         — admin's card; referenced in Debt
Debt               — amount (Decimal 10,2), description, date, creditCardId?
Payment            — amount, date, method (PIX | CASH), debtId? (optional — links to a specific debt)
PasswordResetToken — unique token, expiresAt, cascades with User
```

### Key lib files

- `src/lib/debt-allocation.ts` — computes which payments cover which debts (smallest-first). Result is **never** persisted.
- `src/lib/prisma.ts` — singleton PrismaClient.
- `src/lib/email-notifications.ts` — Resend email sender (`noreply@wlcsv.dev`).
- `src/lib/rate-limit.ts` — in-memory rate limiter for auth routes.

### Testing conventions

- Unit tests in `src/lib/__tests__/`; Prisma is mocked via `src/lib/__tests__/helpers/prisma-mock.ts`.
- E2E tests in `e2e/`; use a dedicated test user (`e2e@debt-tracker.test`) created in `global-setup.ts` and removed in `global-teardown.ts`.
- Playwright saves auth state to `e2e/.auth/user.json` and reuses it across desktop + mobile projects.

## Environment variables

Every new variable must also be added to `.env.example` with a placeholder value.

```env
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=              # generate with: npx auth secret
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
NOTIFICATIONS_SECRET=     # random secure string to authenticate the notifications service
```

## Rules

- **Never persist derived data** — balances and debt allocations are always computed at runtime.
- **PaymentMethod enum** is `PIX | CASH` only — never `CREDIT_CARD`.
- **Notifications** are fire-and-forget — never `await` them in a way that delays the response.
- **Every new env var** must also be added to `.env.example`.
- **Design:** HUD/monochromatic (grayscale, no accent colors, no emojis). Use uppercase text instead of icons (`"HIDE"` not `👁`). Light bg is `#c8c8d0`, not white. Dark/light toggle exists.
- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.).
- **Never deploy** without Wallacy reviewing the feature first.
