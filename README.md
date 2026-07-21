# Debt Tracker

Personal application to track debts owed by third parties. Each debtor gets a shareable link to check their own balance. Includes a bank statement import feature (PDF parsing + optional LLM-assisted extraction) to speed up logging debts/payments from real statements. The UI is in Brazilian Portuguese.

📖 **Full documentation (architecture, conventions, subsystem deep-dives) lives in the [wiki](https://github.com/wlcvs/debt-tracker/wiki).**

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **PostgreSQL** (Docker locally / Neon in production)
- **Prisma 7** — ORM with migrations
- **Auth.js v5** — admin-only credentials authentication
- **Tailwind CSS 4** — HUD/monochromatic design, dark/light mode
- **pdf.js** — client-side statement PDF rendering + server-side parsing (Nubank, Itaú, Mercado Pago, Bradesco)
- **Vitest** — unit tests

## Quick start

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, AUTH_SECRET, etc.
docker compose up -d       # start local Postgres
npx prisma migrate dev     # run migrations + generate Prisma client
npx tsx prisma/seed.ts     # create the admin user
npm run dev
```

See the wiki's [Setup and Commands](https://github.com/wlcvs/debt-tracker/wiki/Setup-and-Commands) page for prerequisites, all npm scripts, and the full environment variable reference.
