# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app does

Personal debt tracker where the admin (Wallacy) logs debts and payments for people who owe him. Each person's `id` in the database serves as their access code for a read-only public view at `/public/[id]`.

This project was also rewritten once in Django (`debt-tracker-django`, a sibling repo). The two diverged; this repo (Next.js) is the one confirmed to keep receiving feature work — `debt-tracker-django` is frozen. Everything Django had that this repo didn't (debt `title`/`paid`, payment `description`, the bank statement import feature) has been ported over; if you're comparing behavior against the Django source, treat it as the reference for anything not yet covered here, but this repo is the target going forward.

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

Local dev Postgres runs as its own database (`debt_tracker_next` in `DATABASE_URL`) — it does **not** share a database with `debt-tracker-django`, even though both may run on the same local Postgres server/port. Don't repoint `DATABASE_URL` at the Django repo's database; the two schemas aren't compatible and Prisma will see the other app's tables as unmanaged drift.

Prisma client is generated into `src/generated/prisma` — always run `npx prisma generate` after schema changes.

## Architecture

### Route structure

```
src/app/
  (dashboard)/          # admin-only; protected by Edge middleware (proxy.ts)
    page.tsx            # dashboard: stats + person list + add person + credit cards + statement import launcher
    person/[id]/        # debtor detail view
  public/[code]/        # debtor read-only view, no login required; [code] = person's DB id
  login/                # admin login
  api/
    auth/[...nextauth]/
    statements/[id]/pdf/   # GET — streams a stored Statement's raw PDF bytes (auth + ownership guarded)
```

### Server Actions

All mutations go through Server Actions in `src/lib/actions/`:
- `person.ts` — CRUD for debtors
- `debt.ts` — add/edit/delete/toggle-paid for debts
- `payment.ts` — add/edit/delete payments
- `credit-card.ts` — admin's credit cards (referenced in debts)
- `auth.ts` — admin login/logout
- `statement.ts` — bank statement import: `importStatement`, `reopenStatement`, `saveImportedTransactions`, `saveLlmFeedback`, `deleteStatement`, `getStatements`. Note: this file cannot export non-function values (e.g. `maxDuration`) alongside `"use server"` — Next.js requires every export of such a module to be an async function, or the whole module breaks in the client bundle. `maxDuration` for the import flow is set on `src/app/(dashboard)/page.tsx` instead (the only route that invokes these actions).

### Auth

Single session — admin only:
- **Admin** — Auth.js v5 Credentials, JWT, role `admin` injected in `auth.config.ts`. Edge middleware (`proxy.ts`) reads this to protect `(dashboard)` routes.
- **Public** — `/public/[code]` requires no login; the URL itself is the access code.

`auth.config.ts` is intentionally split from `auth.ts` so it can be imported in the Edge runtime.

### Prisma models

```
User        — admin; owns People, CreditCards, Statements, LLMFeedback
Person      — debtor; id (serves as access code), name
CreditCard  — admin's card; referenced in Debt
Debt        — amount (Decimal 10,2), title (required label), description (optional notes, default ""),
              paid (default false — excluded from every balance sum when true), date, method (PIX|CASH)?, creditCardId?
Payment     — amount, description (optional, default ""), date, method (PIX | CASH)
Statement   — cached PDF import: userId, bank, filename, pdfData (Bytes), transactionCount,
              algoResults/llmResults (Json), extractedText, uploadedAt
LLMFeedback — a manually-corrected transaction the LLM missed: userId, bank, date, description, amount,
              context — reused as few-shot examples on future extracts for that bank
```

**`paid` on Debt** toggles whether the debt counts toward balance — every balance computation (`getOverviewStats`, `getPeopleWithBalances`, `getPersonById`, `getDebtorViewById`) must sum only `!d.paid` debts. This is easy to silently break when adding a new aggregate — grep for existing `.paid` filters before writing a new one.

### Bank statement import

Upload a PDF from a card/bank statement at `/dashboard` → "Extratos"; nothing is auto-saved, both extraction methods are shown side by side for manual review/correction before import.

- **Algorithmic parsers** in `src/lib/importers/`: `base.ts` (shared `Transaction` type, BR amount/date parsing, `pdf-text.ts` re-export), `pdf-text.ts` (wraps `pdfjs-dist/legacy/build/pdf.mjs` for server-side text/line extraction), `{nubank,itau,mercadopago,bradesco}.ts` (bank-specific parsers), `index.ts` (`detectAndParse` — sniffs the bank from PDF text, "try all four, keep the best" fallback for unrecognized statements).
- **Shared line-reconstruction primitive**: `src/lib/pdf/group-lines.ts`'s `groupLines`/`lineText` cluster pdf.js text items into visual rows by baseline y and reconstruct text with gap-aware spacing (pdf.js doesn't synthesize spaces across column gaps the way some other text extractors do). Used by both the server-side parsers and the client-side highlighter, so the two can't silently drift on what counts as "the same row."
- **External LLM extraction server** via `src/lib/llm-client.ts` — a separate service (not in this repo), configured with `LLM_BASE_URL`. If unset or unreachable, `healthCheck()`/`extract()` resolve to `false`/`{}` and the UI falls back to algorithmic-only results — never throw on a missing/dead LLM server.
- **Review UI**: `src/components/import-modal.tsx` renders the PDF client-side with pdf.js (one `<canvas>` per page, zoom in/out) and highlights the row matching a clicked transaction (`src/lib/pdf-highlight.ts`: `findMatches`/`pickBestMatch`/`expandRowBand`/`buildHighlightRect`). The pdf.js document/canvas state lives in `src/lib/pdf-viewer-controller.ts`, a plain class held in a `useRef` — never put it in `useState`, it's non-serializable and shouldn't be Proxy-wrapped or trigger re-renders.
- **pdfjs-dist + Next.js bundling gotcha**: `pdfjs-dist` is listed in `next.config.ts`'s `serverExternalPackages` (the server-side legacy build resolves its worker via a relative import that breaks once bundled). That setting also makes Next try to externalize the *client* build's worker asset reference during SSR of any component that imports it — so `ImportModal` is loaded via `next/dynamic(..., { ssr: false })` in `statement-import-launcher.tsx` to keep it out of server compilation entirely. Don't import `import-modal.tsx`, `pdf-viewer-controller.ts`, or `pdf-highlight.ts` from a server-rendered path without the same treatment.
- Each upload is cached as a `Statement` (raw PDF bytes + `algoResults`/`llmResults`/`extractedText`) so reopening a past import doesn't require re-parsing or re-hitting the LLM server (`reopenStatement(id, { fresh: true })` forces a re-run). Manually-added transactions during review are submitted as `LLMFeedback`, injected as few-shot examples (last 10, per bank) on future extracts for that bank.
- Store local test PDFs in `statements/` (gitignored for `*.pdf`/`*.PDF` — they're real personal bank statements, never commit them; the folder is named in English unlike the sibling Django repo's `extratos/`). `src/lib/__tests__/importers/fixtures.test.ts` reads from `src/lib/__tests__/fixtures/` (also gitignored) and skips gracefully when a fixture file isn't present, so the suite doesn't fail in CI/other machines.

### Key lib files

- `src/lib/prisma.ts` — singleton PrismaClient.
- `src/lib/payment-methods.ts` — maps `PaymentMethod` enum values to display labels (`PIX → "Pix"`, `CASH → "Dinheiro"`).
- `src/lib/llm-client.ts`, `src/lib/pdf-highlight.ts`, `src/lib/pdf-viewer-controller.ts`, `src/lib/pdf/group-lines.ts`, `src/lib/importers/` — see "Bank statement import" above.

### Testing conventions

- Unit tests in `src/lib/__tests__/`, mirroring `src/lib/` structure: `actions/` (one file per action module — `person`, `debt`, `payment`, `credit-card`, `statement`), `importers/`, `pdf/`, plus `llm-client.test.ts` and `pdf-highlight.test.ts`.
- Prisma is mocked via `src/lib/__tests__/helpers/prisma-mock.ts` — tests never hit the DB. It also mocks `$transaction` (passing itself through for the interactive-transaction form used by `saveImportedTransactions`).
- Tests cover: auth guards, happy paths, input validation, and (for statement actions) the cached-vs-fresh LLM branching and graceful degradation when the LLM server is offline.
- `src/lib/__tests__/importers/fixtures.test.ts` uses real bank statement PDFs — see "Bank statement import" above for why they're not committed.

### UI patterns

- **Detail modals**: clicking a debt/payment row opens a modal with a view mode (title/amount/description/date/method badge, plus a paid toggle for debts) and an "Editar" button that swaps the same modal to an edit form — not a separate route or a second modal. See `debt-detail-modal.tsx`/`payment-detail-modal.tsx` for the pattern; `public-view.tsx`'s modals are the read-only variant (no edit/delete/paid-toggle, but a "✓ Paga" indicator when relevant).
- **Method selection** (Pix/Dinheiro/credit card): `src/components/method-select.tsx`, a controlled button+dropdown-list component with a hidden `<input>` for form submission — not a native `<select>`. Debt method options include credit cards (`value` = the card's own id, not prefixed); payment options are Pix/Dinheiro only.
- **Filter/sort panels**: debt and payment lists (`debts-section.tsx`, `payments-section.tsx`, and `public-view.tsx`'s lists) each own local filter state (search, date range, amount range) and sort state (date/amount, asc/desc) — not shared across sections. Switching to a different sort key always resets direction to `desc`; clicking the same key again toggles it. Amount-range filters compare by `Math.floor(amount)` when the input has no decimal point (e.g. typing `222` should still match `222.70`).
- **Form validation messages**: native browser validation tooltips are replaced globally by `src/components/form-validation-messages.tsx` (mounted once in the root layout), which listens for the `invalid` event and inserts a styled inline message instead. Don't add per-field error `useState` for basic `required`/type validation in new forms — rely on native `required`/`type` attributes and let this component handle the message; only add custom state for validation native attributes can't express (e.g. the method dropdown's hidden input, which doesn't support `required`).
- **pdfjs-dist in a "use client" component**: never a plain top-level `import { X } from "pdfjs-dist"` — it evaluates browser-only globals (`DOMMatrix`, etc.) immediately, which crashes SSR. Load it via dynamic `import("pdfjs-dist")` inside a function, and if you need something like `Util` outside that function, cache the loaded module and expose a getter (see `pdf-viewer-controller.ts`'s `getLoadedPdfjs()`) rather than importing it directly elsewhere.

## Environment variables

Every new variable must also be added to `.env.example` with a placeholder value.

```env
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=              # generate with: openssl rand -base64 33 (npx auth secret now installs the unrelated Better Auth CLI)
NEXT_PUBLIC_APP_URL=
LLM_BASE_URL=             # external LLM extraction server for statement import; empty = algorithmic-only, no error
```

## Rules

- **Never persist derived data** — balances are always computed at runtime.
- **PaymentMethod enum** is `PIX | CASH` only — never `CREDIT_CARD`.
- **Every new env var** must also be added to `.env.example`.
- **Design:** HUD/monochromatic (grayscale, no accent colors, no emojis). Use uppercase text instead of icons (`"HIDE"` not `👁`) — this includes edit/delete affordances on list rows: no pencil/cross icon buttons, the whole row is a click target that opens a detail modal (view → edit → delete in one place; see `debt-detail-modal.tsx`/`payment-detail-modal.tsx`). Light bg is `#e8e8ed`, not white. Dark/light toggle exists — the toggle's own label text (e.g. "Tema escuro") is itself the full click target, not a separate static "Tema" label next to a smaller button. **The UI is in Brazilian Portuguese** — all labels, placeholders, buttons, and messages must be in pt-BR.
- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.).
- **Never deploy** without Wallacy reviewing the feature first.
- **Keep it simple** — this is a single-admin personal app; avoid overengineering.
- **Validate all inputs with Zod** — never use `as string` casts on FormData; always parse with an explicit schema. Use `formData.get("field") ?? undefined` when the field is optional so Zod's `.default()` fires correctly.
- **Zod v4 formats** — use `z.email()` (standalone), not the deprecated `z.string().email()`.
