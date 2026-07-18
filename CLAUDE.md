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

**Testing the dev server from a phone on the same LAN** (e.g. `http://192.168.x.x:3000`): Next.js blocks cross-origin requests to dev-only resources (`/_next/webpack-hmr`, RSC/HMR fetches) by default. When blocked, the page still renders normally, but React hydration silently fails to attach *any* client-side event handler — every button looks present but does nothing, with no console error. The dev server terminal logs the tell: `⚠ Blocked cross-origin request to Next.js dev resource ... from "<ip>"`. Fix by adding that IP to `allowedDevOrigins` in `next.config.ts` and restarting the dev server. That IP is DHCP-assigned and can change (new Wi-Fi, router restart) — if buttons stop responding again after a network change, check the terminal for the same warning with a new IP.

Agent skills for this repo: `setup-debt-tracker` (`.claude/skills/setup-debt-tracker/`) does one-time environment setup on a fresh checkout — Docker/Postgres install, `.env`, deps, migrate, seed. `run-debt-tracker` (`.claude/skills/run-debt-tracker/`) starts/drives/verifies an already-set-up app via `smoke.sh` (boots Postgres + dev server, logs in through the real Auth.js flow, confirms the dashboard renders) — use it instead of ad-hoc `curl`/`npm run dev` when verifying a change works end-to-end.

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
- `debt.ts` — add/edit/delete/toggle-paid for debts, plus installment support: `createDebt` accepts `installments`/`installmentDirection`/`paidInstallments` to create a linked group of `Debt` rows; `deleteDebtInstallmentGroup`, `toggleDebtsPaidBulk`, `getDebtInstallmentGroup` operate on a whole group at once
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
              paid (default false — excluded from every balance sum when true), date, method (PIX|CASH)?, creditCardId?,
              installmentGroupId/installmentIndex/installmentTotal (all optional — set together when a debt is one
              installment of a parceled purchase; null/null/null for a standalone debt)
Payment     — amount, description (optional, default ""), date, method (PIX | CASH)
Statement   — cached PDF import: userId, bank, filename, pdfData (Bytes), transactionCount,
              algoResults/llmResults (Json), extractedText, uploadedAt
LLMFeedback — a manually-corrected transaction the LLM missed: userId, bank, date, description, amount,
              context — reused as few-shot examples on future extracts for that bank
```

**`paid` on Debt** toggles whether the debt counts toward balance — every balance computation (`getOverviewStats`, `getPeopleWithBalances`, `getPersonById`, `getDebtorViewById`) must sum only `!d.paid` debts. This is easy to silently break when adding a new aggregate — grep for existing `.paid` filters before writing a new one.

### Installments (parceled debts)

A parceled debt is just N `Debt` rows sharing one `installmentGroupId`, each with its own `installmentIndex`/`installmentTotal`, `paid`, and `date` — there's no separate "installment plan" model. `src/lib/installments.ts` holds the two pure functions both the server action and the create-form preview call, so they never drift:
- `splitInstallmentAmounts(total, count)` — divides the total into cents, putting any leftover cent on the *last* installments so the sum always matches exactly what was typed.
- `installmentDate(baseDate, index, total, direction)` — `"forward"` treats `baseDate` as installment 1 and steps forward monthly (via `date-utils.ts`'s `addMonthsClamped`, which clamps day-of-month overflow, e.g. Jan 31 + 1 month → Feb 28/29); `"backward"` treats `baseDate` as the *last* installment and steps backward — used to log a purchase that's already fully paid off retroactively.

`createDebt` (`src/lib/actions/debt.ts`) branches on `installments > 1` to create the whole group via `prisma.debt.createMany`; each individual installment's `paid` flag can be set at creation time via `paidInstallments` (a JSON array of 1-based indexes), letting you record some/all installments as already paid without a separate step. A single (non-parceled) debt can also be created already `paid: true` the same way.

Once a debt belongs to a group, the UI treats it as a unit: `debt-detail-modal.tsx` hides "Editar" for grouped debts (no per-installment editing) and its delete button calls `deleteDebtInstallmentGroup` instead of `deleteDebt`, removing the whole group. `installment-group-panel.tsx` (opened via "Ver parcelas" in the modal) lists every installment in a group and can bulk-mark a selection as paid (`toggleDebtsPaidBulk`), optionally also creating real `Payment` record(s) for the selected installments via `createPayment` — either one lump-sum payment or one per installment.

### Bank statement import

Upload a PDF from a card/bank statement at `/dashboard` → "Extratos"; nothing is auto-saved, both extraction methods are shown side by side for manual review/correction before import.

- **Algorithmic parsers** in `src/lib/importers/`: `base.ts` (shared `Transaction` type, BR amount/date parsing, `pdf-text.ts` re-export), `pdf-text.ts` (wraps `pdfjs-dist/legacy/build/pdf.mjs` for server-side text/line extraction), `{nubank,itau,mercadopago,bradesco}.ts` (bank-specific parsers), `index.ts` (`detectAndParse` — sniffs the bank from PDF text, "try all four, keep the best" fallback for unrecognized statements).
- **Shared line-reconstruction primitive**: `src/lib/pdf/group-lines.ts`'s `groupLines`/`lineText` cluster pdf.js text items into visual rows by baseline y and reconstruct text with gap-aware spacing (pdf.js doesn't synthesize spaces across column gaps the way some other text extractors do). Used by both the server-side parsers and the client-side highlighter, so the two can't silently drift on what counts as "the same row."
- **LLM extraction** via `src/lib/llm-extract/` — talks directly to Ollama's OpenAI-compatible API (`ollama-client.ts`), configured with `OLLAMA_BASE_URL`/`OLLAMA_MODEL`. If unset or unreachable, `healthCheck()`/`extract()` (the public interface in `index.ts`) resolve to `false`/`{}` and the UI falls back to algorithmic-only results — never throw on a missing/dead Ollama server. This inlines what used to be a separate Python/FastAPI sidecar (`bank-statement-extractor`, now retired): `base.ts` holds the shared prompt/parsing plumbing (`SYSTEM_PROMPT`, `callLlm`, `parseResponse`/`normDate`/`normAmount`, the `_CREDIT_RE` safety net, `extractGeneric` fallback), one file per bank (`itau.ts`, `nubank.ts`, `bradesco.ts`, `mercadopago.ts`) holds that bank's pre-processing + prompt hint (mirroring the pattern in `src/lib/importers/`, not to be confused with it — these do LLM-oriented text pre-processing, not full algorithmic parsing), and `dispatch.ts` routes by the bank name already detected by `detectAndParse`. The LLM itself keeps running locally (no cloud cost) — since this app runs on Vercel, `OLLAMA_BASE_URL` must point at a tunnel (Cloudflare Tunnel/Tailscale Funnel) exposing the local Ollama instance, not `localhost`.
- **Review UI**: `src/components/import-modal.tsx` renders the PDF client-side with pdf.js (one `<canvas>` per page, zoom in/out) and highlights the row matching a clicked transaction (`src/lib/pdf-highlight.ts`: `findMatches`/`pickBestMatch`/`expandRowBand`/`buildHighlightRect`). The pdf.js document/canvas state lives in `src/lib/pdf-viewer-controller.ts`, a plain class held in a `useRef` — never put it in `useState`, it's non-serializable and shouldn't be Proxy-wrapped or trigger re-renders.
- **pdfjs-dist + Next.js bundling gotcha**: `pdfjs-dist` is listed in `next.config.ts`'s `serverExternalPackages` (the server-side legacy build resolves its worker via a relative import that breaks once bundled). That setting also makes Next try to externalize the *client* build's worker asset reference during SSR of any component that imports it — so `ImportModal` is loaded via `next/dynamic(..., { ssr: false })` in `statement-import-launcher.tsx` to keep it out of server compilation entirely. Don't import `import-modal.tsx`, `pdf-viewer-controller.ts`, or `pdf-highlight.ts` from a server-rendered path without the same treatment.
- **pdfjs-dist server-side `DOMMatrix` crash**: the legacy build's `DOMMatrix`/`Path2D` polyfill comes from `@napi-rs/canvas`'s platform-specific optional dependency (e.g. `@napi-rs/canvas-linux-x64-gnu`) — a known npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) sometimes skips installing that optional package even though it's in `package-lock.json`, and the app doesn't notice until a PDF is actually parsed. Symptom: dev server log shows `Cannot load "@napi-rs/canvas" package: Cannot find native binding` followed by `ReferenceError: DOMMatrix is not defined`, which crashes the import request and surfaces client-side only as a generic "Failed to fetch". Fix: `rm -rf node_modules && npm install` (no need to touch `package-lock.json` — the entry is already correct, npm just failed to materialize it) and confirm `node_modules/@napi-rs/canvas-linux-x64-gnu` (or your platform's equivalent) exists.
- Each upload is cached as a `Statement` (raw PDF bytes + `algoResults`/`llmResults`/`extractedText`) so reopening a past import doesn't require re-parsing or re-hitting the LLM server (`reopenStatement(id, { fresh: true })` forces a re-run). Manually-added transactions during review are submitted as `LLMFeedback`, injected as few-shot examples (last 10, per bank) on future extracts for that bank.
- Store local test PDFs in `statements/` (gitignored for `*.pdf`/`*.PDF` — they're real personal bank statements, never commit them; the folder is named in English unlike the sibling Django repo's `extratos/`). `src/lib/__tests__/importers/fixtures.test.ts` reads from `src/lib/__tests__/fixtures/` (also gitignored) and skips gracefully when a fixture file isn't present, so the suite doesn't fail in CI/other machines.

### Key lib files

- `src/lib/prisma.ts` — singleton PrismaClient.
- `src/lib/payment-methods.ts` — maps `PaymentMethod` enum values to display labels (`PIX → "Pix"`, `CASH → "Dinheiro"`).
- `src/lib/date-utils.ts` — `getMonthKey`/`formatMonthLabel`/`getAvailableMonths`/`addMonthsClamped`/`formatDateBR`. All calendar-date math here operates on the Date object's **UTC** components, not local — dates in this app originate from date-only strings (`z.coerce.date()` on `"YYYY-MM-DD"` form input), which JS always parses as UTC midnight, so using local getters would silently shift the day in timezones west of UTC. Keep this convention when adding new date logic.
- `src/lib/installments.ts` — `splitInstallmentAmounts`/`installmentDate`; see "Installments" above.
- `src/lib/llm-extract/`, `src/lib/pdf-highlight.ts`, `src/lib/pdf-viewer-controller.ts`, `src/lib/pdf/group-lines.ts`, `src/lib/importers/` — see "Bank statement import" above.

### Testing conventions

- Unit tests in `src/lib/__tests__/`, mirroring `src/lib/` structure: `actions/` (one file per action module — `person`, `debt`, `payment`, `credit-card`, `statement`), `importers/`, `llm-extract/`, `pdf/`, plus `date-utils.test.ts`, `installments.test.ts`, and `pdf-highlight.test.ts`.
- Prisma is mocked via `src/lib/__tests__/helpers/prisma-mock.ts` — tests never hit the DB. It also mocks `$transaction` (passing itself through for the interactive-transaction form used by `saveImportedTransactions`).
- Tests cover: auth guards, happy paths, input validation, and (for statement actions) the cached-vs-fresh LLM branching and graceful degradation when the LLM server is offline.
- `src/lib/__tests__/importers/fixtures.test.ts` uses real bank statement PDFs — see "Bank statement import" above for why they're not committed.

### UI patterns

- **Detail modals**: clicking a debt/payment row opens a modal with a view mode (title/amount/description/date/method badge, plus a paid toggle for debts) and an "Editar" button that swaps the same modal to an edit form — not a separate route or a second modal. See `debt-detail-modal.tsx`/`payment-detail-modal.tsx` for the pattern; `public-view.tsx`'s modals are the read-only variant (no edit/delete/paid-toggle, but a "✓ Paga" indicator when relevant).
- **Method selection** (Pix/Dinheiro/credit card): `src/components/method-select.tsx`, a controlled button+dropdown-list component with a hidden `<input>` for form submission — not a native `<select>`. Debt method options include credit cards (`value` = the card's own id, not prefixed); payment options are Pix/Dinheiro only.
- **Filter/sort panels**: debt and payment lists (`debts-section.tsx`, `payments-section.tsx`, and `public-view.tsx`'s lists) each own local filter state (search, amount range, paid status) and sort state (date/amount, asc/desc) — not shared across sections. Switching to a different sort key always resets direction to `desc`; clicking the same key again toggles it. Amount-range filters compare by `Math.floor(amount)` when the input has no decimal point (e.g. typing `222` should still match `222.70`). Dashboard lists (`debts-section.tsx`/`payments-section.tsx`) also keep a manual `dateFrom`/`dateTo` range filter; `public-view.tsx`'s lists dropped it in favor of the month carousel below.
- **Month carousel**: `month-carousel.tsx` is a controlled row of month chips (`months: string[]` of `"YYYY-MM"` keys from `date-utils.ts`'s `getAvailableMonths`, `selected`, `onSelect`), reused in two places. In `public-view.tsx`, one carousel sits above both the debts and payments lists and drives both via a single `selectedMonth` — it fully replaced the old date-range filter there. In the dashboard's `/person/[id]`, `person-month-view.tsx` wraps `debts-section.tsx`/`payments-section.tsx` with the same carousel, passed down as an additional (not exclusive) filter — the existing `dateFrom`/`dateTo` inputs still work alongside it. A debt belonging to an installment group shows a small "Parcela i/N" badge next to its title in every list/modal (`editable-debt.tsx`, `debt-detail-modal.tsx`, `public-view.tsx`).
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
OLLAMA_BASE_URL=          # Ollama's OpenAI-compatible API for LLM statement extraction (e.g. http://localhost:11434/v1
                          # locally, or a tunnel URL like a Cloudflare Tunnel/Tailscale Funnel hostname when deployed);
                          # empty = algorithmic-only, no error
OLLAMA_MODEL=             # defaults to qwen2.5:3b if unset
```

## Rules

- **Never persist derived data** — balances are always computed at runtime.
- **PaymentMethod enum** is `PIX | CASH` only — never `CREDIT_CARD`.
- **Every new env var** must also be added to `.env.example`.
- **Design:** HUD/monochromatic (grayscale, no accent colors, no emojis). Use uppercase text instead of icons — no icons anywhere in the app, full stop (`"HIDE"` not `👁`, `"Fechar"` not `✕`, `"COPIADO"` not `"COPIADO ✓"`). This includes edit/delete affordances on list rows: no pencil/cross icon buttons, the whole row is a click target that opens a detail modal (view → edit → delete in one place; see `debt-detail-modal.tsx`/`payment-detail-modal.tsx`). Sort-direction indicators use `+`/`-` (ascending/descending), not arrow glyphs (`↑`/`↓`). Light bg is `#e8e8ed`, not white. Dark/light toggle exists — the toggle's own label text (e.g. "Tema escuro") is itself the full click target, not a separate static "Tema" label next to a smaller button. **The UI is in Brazilian Portuguese** — all labels, placeholders, buttons, and messages must be in pt-BR.
- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.).
- **Never deploy** without Wallacy reviewing the feature first.
- **Keep it simple** — this is a single-admin personal app; avoid overengineering.
- **Validate all inputs with Zod** — never use `as string` casts on FormData; always parse with an explicit schema. Use `formData.get("field") ?? undefined` when the field is optional so Zod's `.default()` fires correctly.
- **Zod v4 formats** — use `z.email()` (standalone), not the deprecated `z.string().email()`.
