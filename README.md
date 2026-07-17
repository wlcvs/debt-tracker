# Debt Tracker

Personal application to track debts owed by third parties. Each debtor gets a shareable link to check their own balance. Includes a bank statement import feature (PDF parsing + optional LLM-assisted extraction) to speed up logging debts/payments from real statements. The UI is in Brazilian Portuguese.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **PostgreSQL** (Docker locally / Neon in production)
- **Prisma 7** — ORM with migrations
- **Auth.js v5** — admin-only credentials authentication
- **Tailwind CSS 4** — HUD/monochromatic design, dark/light mode
- **pdf.js** — client-side statement PDF rendering + server-side parsing (Nubank, Itaú, Mercado Pago, Bradesco)
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
| `/` | Admin | Dashboard with stats, debtor list, credit cards, and statement import |
| `/person/[id]` | Admin | Debts and payments for a specific debtor |
| `/public/[code]` | Public | Debtor's read-only view (code = person's DB id) |
| `/login` | Public | Admin authentication |
| `/api/statements/[id]/pdf` | Admin | Streams a saved statement's raw PDF bytes |

## Environment Variables

See `.env.example` for all required variables. `LLM_BASE_URL` is optional — if unset, the statement import feature falls back to algorithmic-only extraction with no error.

## Bank statement import

From the dashboard, click "Extratos" to upload a PDF bank/card statement. It's parsed two ways in parallel — an algorithmic parser per bank (Nubank, Itaú, Mercado Pago, Bradesco) and, if `LLM_BASE_URL` points at a running extraction server, an LLM pass — and both result sets are shown for review before anything is saved. The PDF renders client-side via pdf.js; clicking a row highlights the matching line in the source document. Uploads are cached so reopening one later doesn't require re-parsing.

For local testing, drop real statement PDFs in `statements/` (gitignored — these are real personal financial documents, never commit them).
