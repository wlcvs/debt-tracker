# Debt Tracker

Personal application to track debts owed by third parties. Each debtor receives an access code and can check their own balance independently.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **PostgreSQL** (Docker locally / Neon in production)
- **Prisma 7** — ORM with migrations
- **Auth.js v5** — credentials-based authentication
- **Tailwind CSS 4** — HUD/monochromatic design, dark/light mode
- **Resend** — email sending (password recovery)
- **Vitest** — unit tests
- **Playwright** — E2E tests

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)
- [Resend](https://resend.com) account with a verified domain

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, etc.

# 3. Start the database
docker compose up -d

# 4. Run migrations and generate the Prisma client
npx prisma migrate dev
npx prisma generate

# 5. Create the admin user
npx tsx prisma/seed.ts

# 6. Start the development server
npm run dev
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js server in development mode |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Test coverage |
| `npm run test:e2e` | Playwright E2E (requires `npm run dev` running) |
| `npm run test:e2e:ui` | Playwright with visual UI |
| `npm run test:all` | Vitest + Playwright in sequence |
| `npm run build` | Production build |

## Routes

| Route | Access | Description |
|---|---|---|
| `/` | Admin | General dashboard with statistics |
| `/person/[id]` | Admin | Details for a specific debtor |
| `/public` | Public | Form to look up by access code |
| `/public/[code]` | Public | Direct access without typing a code |
| `/login` | Public | Authentication |
| `/forgot-password` | Public | Password recovery |
| `/reset-password/[token]` | Public | Password reset |

## Tests

```bash
# Unit tests (Vitest) — no database, everything mocked
npm run test:run

# E2E (Playwright) — requires dev server running in another tab
npm run dev          # tab 1
npm run test:e2e     # tab 2
```

E2E tests create an isolated test user (`e2e@debt-tracker.test`) and remove all data at the end.

## Environment Variables

See `.env.example` for all required variables.
