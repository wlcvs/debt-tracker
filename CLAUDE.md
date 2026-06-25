# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app does

Personal debt tracker where the admin (Wallacy) logs debts and payments for people who owe him. Each person's `id` in the database serves as their access code for a read-only public view at `/public/[id]`.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (TypeScript, App Router, Server Actions) |
| Database | PostgreSQL — Docker locally / Neon in production |
| ORM | Prisma 7 (client generated at `src/generated/prisma`) |
| Auth | Auth.js v5 (next-auth) — Credentials provider + JWT session (admin only) |
| Styles | Tailwind CSS 4 |
| Tests | Vitest (unit only) |
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

# DB
docker compose up -d                  # start Postgres locally
npx prisma migrate dev                # run migrations + regenerate client
npx prisma generate                   # regenerate client only
npx tsx prisma/seed.ts                # create admin user (ADMIN_EMAIL + ADMIN_PASSWORD)
node --env-file=.env --import tsx/esm prisma/seed-test-data.ts  # populate with fictitious debtors, debts and payments
```

Prisma client is generated into `src/generated/prisma` — always run `npx prisma generate` after schema changes.

## Architecture

### Route structure

```
src/app/
  (dashboard)/          # admin-only; protected by Edge middleware (proxy.ts)
    page.tsx            # dashboard: stats + person list + add person + credit cards
    person/[id]/        # debtor detail view
  public/[code]/        # debtor read-only view, no login required; [code] = person's DB id
  login/                # admin login
  api/
    auth/[...nextauth]/
```

### Server Actions

All mutations go through Server Actions in `src/lib/actions/`:
- `person.ts` — CRUD for debtors
- `debt.ts` — add/edit/delete debts
- `payment.ts` — add/edit/delete payments
- `credit-card.ts` — admin's credit cards (referenced in debts)
- `auth.ts` — admin login/logout

### Auth

Single session — admin only:
- **Admin** — Auth.js v5 Credentials, JWT, role `admin` injected in `auth.config.ts`. Edge middleware (`proxy.ts`) reads this to protect `(dashboard)` routes.
- **Public** — `/public/[code]` requires no login; the URL itself is the access code.

`auth.config.ts` is intentionally split from `auth.ts` so it can be imported in the Edge runtime.

### Prisma models

```
User       — admin; owns People and CreditCards
Person     — debtor; id (serves as access code), name
CreditCard — admin's card; referenced in Debt
Debt       — amount (Decimal 10,2), description, date, creditCardId?
Payment    — amount, date, method (PIX | CASH)
```

### Key lib files

- `src/lib/prisma.ts` — singleton PrismaClient.
- `src/lib/payment-methods.ts` — maps `PaymentMethod` enum values to display labels (`PIX → "Pix"`, `CASH → "Dinheiro"`).

### Testing conventions

- Unit tests in `src/lib/__tests__/actions/`; one file per action module (`person`, `debt`, `payment`, `credit-card`).
- Prisma is mocked via `src/lib/__tests__/helpers/prisma-mock.ts` — tests never hit the DB.
- Tests cover: auth guards, happy paths, and input validation for all server actions.

## Environment variables

Every new variable must also be added to `.env.example` with a placeholder value.

```env
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=              # generate with: npx auth secret
NEXT_PUBLIC_APP_URL=
```

## Rules

- **Never persist derived data** — balances are always computed at runtime.
- **PaymentMethod enum** is `PIX | CASH` only — never `CREDIT_CARD`.
- **Every new env var** must also be added to `.env.example`.
- **Design:** HUD/monochromatic (grayscale, no accent colors, no emojis). Use uppercase text instead of icons (`"HIDE"` not `👁`). Light bg is `#e8e8ed`, not white. Dark/light toggle exists. **The UI is in Brazilian Portuguese** — all labels, placeholders, buttons, and messages must be in pt-BR.
- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.).
- **Never deploy** without Wallacy reviewing the feature first.
- **Keep it simple** — this is a single-admin personal app; avoid overengineering.
- **Validate all inputs with Zod** — never use `as string` casts on FormData; always parse with an explicit schema. Use `formData.get("field") ?? undefined` when the field is optional so Zod's `.default()` fires correctly.
- **Zod v4 formats** — use `z.email()` (standalone), not the deprecated `z.string().email()`.
