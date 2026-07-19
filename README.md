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
- [Ollama](https://ollama.com) (optional — only needed for LLM-assisted statement extraction; the app works algorithmic-only without it)

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

See `.env.example` for all required variables. `OLLAMA_BASE_URL`/`OLLAMA_MODEL` are optional — if `OLLAMA_BASE_URL` is unset, the statement import feature falls back to algorithmic-only extraction with no error.

## Bank statement import

From the dashboard, click "Extratos" to upload a PDF bank/card statement. It's parsed two ways in parallel — an algorithmic parser per bank (Nubank, Itaú, Mercado Pago, Bradesco) and, if `OLLAMA_BASE_URL` points at a reachable Ollama instance, an LLM pass — and both result sets are shown for review before anything is saved. The PDF renders client-side via pdf.js; clicking a row highlights the matching line in the source document. Uploads are cached so reopening one later doesn't require re-parsing.

For local testing, drop real statement PDFs in `statements/` (gitignored — these are real personal financial documents, never commit them).

### LLM-assisted extraction (Ollama)

The LLM pass runs entirely against a locally-hosted model — no cloud LLM cost. Each bank has its own pre-processing (isolating the relevant text/table before handing it to the model) plus a tailored prompt; see `src/lib/llm-extract/` (one file per bank, mirroring `src/lib/importers/`'s structure) for the exact strategy per bank:

| Bank | Strategy |
|---|---|
| Nubank (cartão) | Per-page extraction on pages containing `TRANSAÇÕES` |
| Nubank (extrato) | Per-page extraction on all pages, deduplicated by (date, description, amount) |
| Itaú | Isolates the left column of the `DATA / ESTABELECIMENTO` table via word x/y position |
| Bradesco | Rule-based pre-processing into unambiguous `YYYY-MM-DD DESCRIPTION AMOUNT` lines, then a strict pass-through LLM call (whitelisted against those lines afterward, since small models can still fabricate an extra entry despite the "don't skip/dedupe" instruction) |
| Mercado Pago | Isolates the `Detalhes de consumo` section |
| Unrecognized bank | Generic full-text LLM extraction, no pre-processing |

To run the LLM pass locally:

```bash
ollama pull hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q8_0   # or your own choice of OLLAMA_MODEL
ollama serve             # or run it as a persistent service (systemd, etc.)
```

Then set `OLLAMA_BASE_URL="http://localhost:11434/v1"` in `.env`.

Manually-corrected transactions made during review are saved as `LLMFeedback` and replayed as few-shot examples (last 10, per bank) on future extracts for that bank — this is how extraction quality improves over time without retraining anything.

Since this app is deployed on Vercel but the LLM keeps running on your own machine, `OLLAMA_BASE_URL` in production must point at a tunnel exposing your local Ollama instance over HTTPS (e.g. a Cloudflare Tunnel or Tailscale Funnel hostname) — not `localhost`.

This extraction logic used to live in a separate Python/FastAPI sidecar (`bank-statement-extractor`); it's since been fully ported into this repo (see `src/lib/llm-extract/`) and the sidecar repo retired.
