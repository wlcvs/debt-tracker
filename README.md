# Debt Tracker

Personal application to track debts owed by third parties. Each debtor gets a shareable link to check their own balance.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **PostgreSQL** (Docker locally / Neon in production)
- **Prisma 7** — ORM with migrations
- **Auth.js v5** — admin-only credentials authentication
- **Tailwind CSS 4** — HUD/monochromatic design, dark/light mode
- **Vitest** — unit tests

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL, AUTH_SECRET, etc.

# 3. Start the database
docker compose up -d

# 4. Run migrations and generate the Prisma client
npx prisma migrate dev

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
| `npm run test:coverage` | Test coverage report |
| `npm run build` | Production build |

## Routes

| Route | Access | Description |
|---|---|---|
| `/` | Admin | Dashboard with stats, debtor list and credit cards |
| `/person/[id]` | Admin | Debts and payments for a specific debtor |
| `/public/[code]` | Public | Debtor's read-only view (code = person's DB id) |
| `/login` | Public | Admin authentication |

## Environment Variables

See `.env.example` for all required variables.
