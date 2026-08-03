# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app does

Personal debt tracker where the admin logs debts and payments for people who owe them. Each person has a random 12-character `accessCode` — distinct from their database `id` — that unlocks a read-only public view at `/public/[code]`, which the admin can block per-person at any time.

This project was also rewritten once in Django (`debt-tracker-django`, a sibling repo). The two diverged; this repo (Next.js) is the one confirmed to keep receiving feature work — `debt-tracker-django` is frozen. Everything Django had that this repo didn't (debt `title`/`paid`, payment `description`, the bank statement import feature) has been ported over; if you're comparing behavior against the Django source, treat it as the reference for anything not yet covered here, but this repo is the target going forward.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (TypeScript, App Router, Server Actions) |
| Database | PostgreSQL — Docker locally / Neon in production |
| ORM | Prisma 7 (client generated at `src/generated/prisma`) |
| Auth | Auth.js v5 (next-auth) — Credentials provider + JWT session (admin only) |
| Styles | Tailwind CSS 4 |
| UI primitives | Radix UI (dialog, alert-dialog, select, popover, collapsible, toggle-group, progress) |
| Tests | Vitest (unit + jsdom component tests) + Playwright (E2E) |
| Validation | Zod |

## Commands

```bash
# Dev
npm run dev

# Build
npm run build

# Lint
npm run lint

# Unit + component tests (Vitest, no DB, Prisma mocked)
npm run test:run          # single run — runs both the "node" and "jsdom" projects
npm run test              # watch mode

# E2E (Playwright, real browser, needs Postgres + dev server + a seeded admin user)
npx playwright install --with-deps chromium   # one-time browser install
npm run test:e2e

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
    person/[code]/      # debtor detail view; [code] is the accessCode too, never the DB id
  public/[code]/        # debtor read-only view, no login required; [code] = person's accessCode
  login/                # admin login
  api/
    auth/[...nextauth]/
    statements/[id]/pdf/   # GET — streams a stored Statement's raw PDF bytes (auth + ownership guarded)
```

### Server Actions

All mutations go through Server Actions in `src/lib/actions/`:
- `person.ts` — CRUD for debtors; `getDashboardOverview` aggregates the dashboard's stats + per-person totals directly in Postgres (`groupBy`/`count`/`aggregate`) instead of fetching the full Person→Debt→Payment graph and summing in JS — `getPersonByAccessCode`/`getDebtorViewById` still fetch full per-debt/payment detail via `toPersonWithBalance`, since the person-detail and public pages actually render each row
- `debt.ts` — add/edit/delete/toggle-paid for debts, plus installment support: `createDebt` accepts `installments`/`installmentDirection`/`paidInstallments` to create a linked group of `Debt` rows; `deleteDebtInstallmentGroup`, `toggleDebtsPaidBulk`, `getDebtInstallmentGroup` operate on a whole group at once
- `payment.ts` — add/edit/delete payments
- `credit-card.ts` — admin's credit cards (referenced in debts)
- `auth.ts` — admin login/logout
- `statement.ts` — bank statement import: `importStatement`, `reopenStatement`, `saveImportedTransactions`, `saveLLMFeedback`, `deleteStatement`, `getStatements`. Note: this file cannot export non-function values (e.g. `maxDuration`) alongside `"use server"` — Next.js requires every export of such a module to be an async function, or the whole module breaks in the client bundle. `maxDuration` for the import flow is set on `src/app/(dashboard)/page.tsx` instead (the only route that invokes these actions).

### Auth

Single session — admin only:
- **Admin** — Auth.js v5 Credentials, JWT, role `admin` injected in `auth.config.ts`. Edge middleware (`proxy.ts`) reads this to protect `(dashboard)` routes.
- **Public** — `/public/[code]` requires no login; the URL itself is the access code. `getDebtorViewById` resolves it **only** by `Person.accessCode`. Codes are minted by `src/lib/access-code.ts`.

`auth.config.ts` is intentionally split from `auth.ts` so it can be imported in the Edge runtime.

### Prisma models

```
User        — admin; owns People, CreditCards, Statements, LLMFeedback
Person      — debtor; id (internal only), accessCode (unique, random 12 chars — the public-page
              credential; see src/lib/access-code.ts), name, publicVisible (default true)
CreditCard  — admin's card; referenced in Debt
Debt        — amount (Decimal 10,2), title (required label), description (optional notes, default ""),
              paid (default false — excluded from every balance sum when true), date, method (PIX|CASH)?, creditCardId?,
              installmentGroupId/installmentIndex/installmentTotal (all optional — set together when a debt is one
              installment of a parceled purchase; null/null/null for a standalone debt)
Payment     — amount, description (optional, default ""), date, method (PIX | CASH)
Statement   — cached PDF import: userId, bank, filename, pdfData (Bytes), transactionCount,
              algoResults/LLMResults (Json), extractedText, uploadedAt
LLMFeedback — a manually-corrected transaction the LLM missed: userId, bank, date, description, amount,
              context — reused as few-shot examples on future extracts for that bank
```

**`paid` on Debt** toggles whether the debt counts toward balance — every balance computation (`getDashboardOverview`, `getPersonById`, `getDebtorViewById`) must sum only `!d.paid` debts. This is easy to silently break when adding a new aggregate — grep for existing `.paid` filters before writing a new one.

**`publicVisible` on Person** (default `true`, so existing shared links never break on migrate) gates `/public/[code]` entirely, at the data layer: `getDebtorViewById`'s `where` clause includes `publicVisible: true`, so a hidden person's row comes back `null` from the query itself and the route's existing `if (!debtor) notFound()` handles it with zero extra branching — the page and `PublicView` never need to know the flag exists. Toggled via `togglePersonPublicVisibility` (mirrors `toggleDebtPaid`'s find-then-flip shape), wired to a button in `person-visibility-toggle.tsx` on the dashboard's person page. **Caveat**: `public/[code]`'s `loading.tsx` means this `notFound()` no longer sets a real HTTP 404 (see "UI patterns" below) — a hidden person's page still renders the correct not-found content (no data leak), just with a 200 status. Don't rely on the status code distinguishing hidden-vs-nonexistent from outside the app.

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
- **LLM extraction** via `src/lib/LLM-extract/` — talks directly to any OpenAI-compatible chat completions API (`ollama-client.ts`), configured with `OLLAMA_BASE_URL`/`OLLAMA_MODEL`/`OLLAMA_API_KEY` (default model: `hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q8_0`, a ~1.2GB on-device model chosen for low RAM use — see the chunking/retry point below for why a model this small is viable here). If `OLLAMA_BASE_URL` is unset or the server is unreachable, `healthCheck()`/`extract()` (the public interface in `index.ts`) resolve to `false`/`{}` and the UI falls back to algorithmic-only results — never throw on a missing/dead server. This inlines what used to be a separate Python/FastAPI sidecar (`bank-statement-extractor`, now retired — its GitHub repo was deleted once this port reached parity; this section and the per-bank files below are the complete reference for the original design): `base.ts` holds the shared prompt/parsing plumbing (`SYSTEM_PROMPT`, `callLLM`, `parseResponse`/`normDate`/`normAmount`, the `_CREDIT_RE` safety net, `extractGeneric` fallback), one file per bank (`itau.ts`, `nubank.ts`, `bradesco.ts`, `mercadopago.ts`) holds that bank's pre-processing + prompt hint (mirroring the pattern in `src/lib/importers/`, not to be confused with it — these do LLM-oriented text pre-processing, not full algorithmic parsing), and `dispatch.ts` routes by the bank name already detected by `detectAndParse`. Locally, this points at a local Ollama server (`OLLAMA_BASE_URL=http://localhost:11434/v1`, no `OLLAMA_API_KEY` needed, no cloud cost) managed via `node scripts/ollama.mjs start|stop|status` (a plain background process, not a systemd service). In production (this app runs on Vercel), `OLLAMA_BASE_URL` instead points at a hosted OpenAI-compatible provider's endpoint (e.g. Groq: `https://api.groq.com/openai/v1`, `OLLAMA_MODEL=llama-3.3-70b-versatile`) with `OLLAMA_API_KEY` set — chosen over exposing the local server via a tunnel because `extractChunked()` only ever sends small pre-parsed `date | description | amount` batches (never raw PDF text), making a free hosted API's privacy tradeoff (no training on API data, no permanent retention — verified for Groq specifically) acceptable for the convenience of not depending on a home-network tunnel's uptime.
- **Deterministic pre-processing + chunking + hallucination guard (all banks)**: every bank's LLM extraction pre-computes exact `YYYY-MM-DD DESCRIPTION AMOUNT` lines in code (reusing `src/lib/importers/base.ts`'s `detectYear`/`parseBrDate`/`parseBrAmount` — the same year-inference the algorithmic parsers use, so the two can't drift) before ever calling the LLM, so the model's only job is a strict pass-through JSON conversion — no year math, no free-form judgment about what to skip. `src/lib/LLM-extract/base.ts`'s `extractChunked()` is the single entry point every bank module calls: it splits the clean-line list into small batches via `chunkLines()` (small models start swapping dates/amounts between unrelated lines once a single call holds ~20+ lines; chunk size defaults to 6, overridable via `LLM_CHUNK_SIZE` for `scripts/eval-LLM-extraction.mjs` sweeps), whitelists every response against the real pre-processed lines by `date|amount` via `filterHallucinations()` (eliminates hallucinated transactions by construction, regardless of model quality — this generalizes a guard originally written for Bradesco alone), and retries a chunk whose response doesn't account for all of its own lines. Retries re-send the chunk with its line order **reversed** rather than unchanged — debugging found a *deterministic* (not sampling-noise) small-model failure mode where a chunk ending on a line whose date repeats an earlier line in the same chunk gets its JSON shape garbled every time; reversing the order (so a date-unique line ends the chunk) reliably recovers it. `chunkLines()` also distributes lines evenly rather than slicing at a fixed size, to avoid a small dangling remainder chunk (which was separately observed to provoke hallucination on its own).
- **Evaluating a model swap**: `scripts/eval-LLM-extraction.mjs` (`npm run eval:LLM`, not part of `npm run test:run`/CI — needs a live Ollama server plus the gitignored fixture PDFs) runs the algorithmic parser (ground truth) and the LLM path against all 4 real fixtures for one or more `MODELS` (comma-separated), reporting matched/missed/hallucinated + timing per bank and in total. Use this before changing `OLLAMA_MODEL`'s default — don't trust a model swap's accuracy without measuring it against this script first.
- **Review UI**: `src/components/import-modal.tsx` renders the PDF client-side with pdf.js (one `<canvas>` per page, zoom in/out) and highlights the row matching a clicked transaction (`src/lib/pdf-highlight.ts`: `findMatches`/`pickBestMatch`/`expandRowBand`/`buildHighlightRect`). The pdf.js document/canvas state lives in `src/lib/pdf-viewer-controller.ts`, a plain class held in a `useRef` — never put it in `useState`, it's non-serializable and shouldn't be Proxy-wrapped or trigger re-renders.
- **pdfjs-dist + Next.js bundling gotcha**: `pdfjs-dist` is listed in `next.config.ts`'s `serverExternalPackages` (the server-side legacy build resolves its worker via a relative import that breaks once bundled). That setting also makes Next try to externalize the *client* build's worker asset reference during SSR of any component that imports it — so `ImportModal` is loaded via `next/dynamic(..., { ssr: false })` in `statement-import-launcher.tsx` to keep it out of server compilation entirely. Don't import `import-modal.tsx`, `pdf-viewer-controller.ts`, or `pdf-highlight.ts` from a server-rendered path without the same treatment.
- **pdfjs-dist server-side `DOMMatrix` crash**: the legacy build's `DOMMatrix`/`Path2D` polyfill comes from `@napi-rs/canvas`'s platform-specific optional dependency (e.g. `@napi-rs/canvas-linux-x64-gnu`) — a known npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) sometimes skips installing that optional package even though it's in `package-lock.json`, and the app doesn't notice until a PDF is actually parsed. Symptom: dev server log shows `Cannot load "@napi-rs/canvas" package: Cannot find native binding` followed by `ReferenceError: DOMMatrix is not defined`, which crashes the import request and surfaces client-side only as a generic "Failed to fetch". Fix: `rm -rf node_modules && npm install` (no need to touch `package-lock.json` — the entry is already correct, npm just failed to materialize it) and confirm `node_modules/@napi-rs/canvas-linux-x64-gnu` (or your platform's equivalent) exists.
- Each upload is cached as a `Statement` (raw PDF bytes + `algoResults`/`LLMResults`/`extractedText`) so reopening a past import doesn't require re-parsing or re-hitting the LLM server (`reopenStatement(id, { fresh: true })` forces a re-run). Manually-added transactions during review are submitted as `LLMFeedback`, injected as few-shot examples (last 10, per bank) on future extracts for that bank.
- Store local test PDFs in `statements/` (gitignored for `*.pdf`/`*.PDF` — they're real personal bank statements, never commit them; the folder is named in English unlike the sibling Django repo's `extratos/`). `src/lib/__tests__/importers/fixtures.test.ts` reads from `src/lib/__tests__/fixtures/` (also gitignored) and skips gracefully when a fixture file isn't present, so the suite doesn't fail in CI/other machines.

### Key lib files

- `src/lib/prisma.ts` — singleton PrismaClient; normalizes a weak `sslmode` (`prefer`/`require`/`verify-ca`) to `verify-full` in `DATABASE_URL` before constructing the `@prisma/adapter-pg` adapter — see "Deployment" below.
- `src/lib/access-code.ts` — `generateAccessCode()` mints the 12-char public-page credential from an unambiguous 31-symbol alphabet (no `0/O`, `1/I/L`), using `crypto.randomInt` rather than `randomBytes % 31` (256 isn't a multiple of 31 — the modulo would bias the low letters). The migration that added the column backfills existing rows with the same alphabet in SQL, so old and new codes are indistinguishable.
- `src/lib/payment-methods.ts` — maps `PaymentMethod` enum values to display labels (`PIX → "Pix"`, `CASH → "Dinheiro"`).
- `src/lib/date-utils.ts` — `getMonthKey`/`formatMonthLabel`/`getAvailableMonths`/`addMonthsClamped`/`formatDateBR`. All calendar-date math here operates on the Date object's **UTC** components, not local — dates in this app originate from date-only strings (`z.coerce.date()` on `"YYYY-MM-DD"` form input), which JS always parses as UTC midnight, so using local getters would silently shift the day in timezones west of UTC. Keep this convention when adding new date logic.
- `src/lib/installments.ts` — `splitInstallmentAmounts`/`installmentDate`; see "Installments" above.
- `src/lib/hooks/use-inline-edit-guard.ts` — lets a Radix `Dialog` tell "this outside-click ended an inline edit" from "this outside-click meant to close me"; see the Radix bullet under "UI patterns".
- `src/lib/LLM-extract/`, `src/lib/pdf-highlight.ts`, `src/lib/pdf-viewer-controller.ts`, `src/lib/pdf/group-lines.ts`, `src/lib/importers/` — see "Bank statement import" above.

### Testing conventions

- Unit tests in `src/lib/__tests__/`, mirroring `src/lib/` structure: `actions/` (one file per action module — `person`, `debt`, `payment`, `credit-card`, `statement`), `importers/`, `LLM-extract/`, `pdf/`, plus `date-utils.test.ts`, `installments.test.ts`, and `pdf-highlight.test.ts`.
- Prisma is mocked via `src/lib/__tests__/helpers/prisma-mock.ts` — tests never hit the DB. It also mocks `$transaction` (passing itself through for the interactive-transaction form used by `saveImportedTransactions`).
- Tests cover: auth guards, happy paths, input validation, and (for statement actions) the cached-vs-fresh LLM branching and graceful degradation when the LLM server is offline.
- `src/lib/__tests__/importers/fixtures.test.ts` uses real bank statement PDFs — see "Bank statement import" above for why they're not committed.
- **`vitest.config.ts` defines two `test.projects`**: `node` (the existing Prisma-mocked action/lib tests above, `src/lib/__tests__/**/*.test.ts`) and `jsdom` (component/hook tests, `src/components/**/*.test.tsx` + `src/lib/hooks/**/*.test.tsx`, via `@testing-library/react`, with `vitest.setup.ts` wiring up `@testing-library/jest-dom` and an `afterEach(cleanup)` — RTL's automatic cleanup doesn't self-register without `test.globals: true`, which this repo intentionally doesn't set). `npm run test:run` runs both. Put a new component/hook test under whichever `include` glob matches its path; a `.tsx` test that imports `@testing-library/react` needs to be under `src/components/` or `src/lib/hooks/`, not `src/lib/__tests__/`.
- **E2E**: `tests/e2e/` (Playwright, `playwright.config.ts` at repo root), covering the golden paths that used to only be checked by hand — login, adding a debt/payment, and the nested-dismiss outside-click behaviors (see `use-dismiss.ts` below). `webServer` mirrors `run-debt-tracker`'s `smoke.sh`: assumes Postgres is already up on `:5432`, reuses an already-running dev server on `:3000` if present. Tests run serially (`workers: 1`) since they mutate shared DB state (creating people/statements via the real UI or directly via Prisma) rather than adding per-test data isolation — consistent with this being a single-admin app. `dismiss-behaviors.spec.ts` seeds/deletes `Statement` rows directly via `prisma` (imported the same way `prisma/seed-test-data.ts` does) with non-empty `LLMResults`/`extractedText` so `reopenStatement()` takes its cached branch and never depends on a live LLM server or real PDF bytes — only the description-edit/rename UI is under test, not PDF parsing. This suite is what caught two real bugs during Phase 0's own setup (see `use-dismiss.ts` and the `import-modal.tsx` backdrop note below) — treat a red E2E run as a real regression, not test flakiness, before assuming otherwise. Every spec's fixture `Person`/`CreditCard` rows must be named/labeled with an `E2E ` prefix — this used to be just a naming convention, but it's now load-bearing: most specs' own end-of-body cleanup only runs if every earlier assertion in that test passed (no `try/finally`), so `tests/e2e/global-cleanup.ts` (wired as both `globalSetup` and `globalTeardown` in `playwright.config.ts`) sweeps any row matching that prefix after every `test:e2e` run regardless of pass/fail, and again before the next run as a second line of defense against the whole process being killed outright. Per-spec cleanup is still worth keeping as its own passing assertion, but the prefix sweep is the actual safety net against leaking fixture data into the real dev database.
- Not covered: pdf.js/canvas rendering inside the statement-import review screen (no headless-canvas assertions) — a known, accepted gap, not a TODO.
- **CI's `test` job has a real Postgres service** (`.github/workflows/ci.yml`, same `postgres:16` service the `e2e` job uses) — needed because `npm run build` now runs `prisma migrate deploy` first (see "Deployment"); without a reachable database that step fails with `P1001`. This means CI's build step genuinely applies migrations against a fresh database on every push, which is deliberate — it's the check that would have caught the outage described in "Deployment" before it reached `main`.

### UI patterns

- **Detail modals**: clicking a debt/payment row opens a modal with a view mode (title/amount/description/date/method badge, plus a paid toggle for debts) and an "Editar" button that swaps the same modal to an edit form — not a separate route or a second modal. See `debt-detail-modal.tsx`/`payment-detail-modal.tsx` for the pattern; `public-view.tsx`'s modals are the read-only variant (no edit/delete/paid-toggle, but a "✓ Paga" indicator when relevant).
- **Method selection** (Pix/Dinheiro/credit card): `src/components/method-select.tsx`, a Radix `Select` with a hidden `<input>` carrying the value for form submission (see the Radix bullet below for why the hidden input, not `Select.Root`'s `name`). Debt method options include credit cards (`value` = the card's own id, not prefixed); payment options are Pix/Dinheiro only.
- **Filter/sort panels**: debt and payment lists (`debts-section.tsx`, `payments-section.tsx`, and `public-view.tsx`'s lists) each own local filter state (search, amount range, paid status) and sort state (date/amount, asc/desc) — not shared across sections. Switching to a different sort key always resets direction to `desc`; clicking the same key again toggles it. Amount-range filters compare by `Math.floor(amount)` when the input has no decimal point (e.g. typing `222` should still match `222.70`). Dashboard lists (`debts-section.tsx`/`payments-section.tsx`) also keep a manual `dateFrom`/`dateTo` range filter; `public-view.tsx`'s lists dropped it in favor of the month carousel below.
- **Month carousel**: `month-carousel.tsx` is a controlled row of month chips (`months: string[]` of `"YYYY-MM"` keys from `date-utils.ts`'s `getAvailableMonths`, `selected`, `onSelect`), reused in two places. In `public-view.tsx`, one carousel sits above both the debts and payments lists and drives both via a single `selectedMonth` — it fully replaced the old date-range filter there. In the dashboard's `/person/[code]`, `person-month-view.tsx` wraps `debts-section.tsx`/`payments-section.tsx` with the same carousel, passed down as an additional (not exclusive) filter — the existing `dateFrom`/`dateTo` inputs still work alongside it. A debt belonging to an installment group shows a small "Parcela i/N" badge next to its title in every list/modal (`editable-debt.tsx`, `debt-detail-modal.tsx`, `public-view.tsx`).
- **Form validation messages**: native browser validation tooltips are replaced globally by `src/components/form-validation-messages.tsx` (mounted once in the root layout), which listens for the `invalid` event and inserts a styled inline message instead. Don't add per-field error `useState` for basic `required`/type validation in new forms — rely on native `required`/`type` attributes and let this component handle the message; only add custom state for validation native attributes can't express (e.g. the method dropdown's hidden input, which doesn't support `required`).
- **Route-level loading states**: `(dashboard)/loading.tsx`, `(dashboard)/person/[code]/loading.tsx`, and `public/[code]/loading.tsx` are Next.js's native streaming mechanism — each route's Server Component still does one blocking `Promise.all(...)`/`await` fetch (no manual `<Suspense>` needed, `loading.tsx` wraps the segment automatically), but the fallback streams to the browser instantly while that resolves. Measured impact: FCP/LCP on `/` went from 2.85s to ~0.94s (P75) combining this with the region fix above. `public/[code]/loading.tsx` replicates the page's own header markup, since that route (unlike the dashboard) has no separate layout splitting header from data-dependent content.
  - **Gotcha: breaks `notFound()`'s HTTP status code.** `public/[code]/page.tsx` and `(dashboard)/person/[code]/page.tsx` both call `notFound()` conditionally (`if (!x) notFound()`). With `loading.tsx` present, Next streams the initial 200 response *before* that check resolves, so by the time `notFound()` runs the status is already committed — it can only affect the rendered content (correctly shows the not-found UI), never the response's actual HTTP status, which stays 200. Moving the check into `generateMetadata()` (normally documented as resolving before the body streams) does **not** fix this — confirmed empirically that once `loading.tsx` makes the whole segment streamable, metadata resolution is no longer blocking either. There's no known way to get both instant streaming and a correct 404 status on the same route in this Next.js version; the tradeoff was accepted deliberately (content is still correct — no data leak — which is what the `publicVisible` toggle actually needs). `tests/e2e/public-view.spec.ts` asserts on rendered content, not `response.status()`, for exactly this reason — don't "fix" those assertions back to checking status without re-verifying this limitation still applies to whatever Next.js version is installed at the time.
- **pdfjs-dist in a "use client" component**: never a plain top-level `import { X } from "pdfjs-dist"` — it evaluates browser-only globals (`DOMMatrix`, etc.) immediately, which crashes SSR. Load it via dynamic `import("pdfjs-dist")` inside a function, and if you need something like `Util` outside that function, cache the loaded module and expose a getter (see `pdf-viewer-controller.ts`'s `getLoadedPdfjs()`) rather than importing it directly elsewhere.
- **UI primitives come from Radix — never hand-roll them.** New modal → `@radix-ui/react-dialog` (destructive confirmation → `react-alert-dialog`); new dropdown → `react-select`; inline region a button expands → `react-collapsible`; mutually-exclusive segmented control → `react-toggle-group`. `person-select.tsx` uses `react-popover` for a combobox-with-create that has to escape a table's stacking context. These replaced a hand-written modal shell, dropdown, disclosure and z-index ladder; the primitives bring focus trap, focus restore, portalling, body scroll lock, `role`/`aria-*` and keyboard navigation that this app previously had none of.
  - **Stacking is portal mount order, not z-index.** `Dialog.Portal` appends to `document.body`, so a dialog opened on top of another paints above it, and Radix's DismissableLayer routes Escape to the topmost layer only. The old `z-10`/`z-20`/`z-40`/`z-50`/`z-[1000]` ladder is gone and must not come back — **nothing outside a portal may claim a z-index**, or a portalled dialog will render behind it (z-index only competes between positioned elements). Two deliberate exceptions stack *within* a `Dialog.Content` rather than against one: `transaction-table.tsx`'s sticky `<thead>` and `manual-add-dialog.tsx`'s overlay.
  - **`Dialog.Content` goes inside `Dialog.Overlay`, not beside it.** The Overlay is the positioning wrapper and the clickable "outside"; a full-screen Content leaves nowhere outside to click and silently disables outside-dismiss. See `modal-shell.tsx` and `import-modal.tsx` (whose dynamic review-step layout lives on the Overlay for exactly this reason).
  - **Inline edits inside a modal** (rename in `StatementsModal`, editable cells in `TransactionTable`) need the modal to decline the dismiss that ended the edit. The two triggers need *different* treatment, and this is the part that is easy to get wrong:
    - **Escape** — read the edit state directly in `onEscapeKeyDown` and `preventDefault()`. Radix listens for Escape on `document` in the **capture** phase and only arms the topmost layer, so it runs before the input's own `onKeyDown` clears that state.
    - **Outside-click** — you *cannot* read the state there. `react-dialog` hardcodes `deferPointerDownOutside: true` on its DismissableLayer, after spreading the caller's props, so `Dialog.Content` cannot opt out; for a left click that defers the decision from `pointerdown` to `click`. Measured order: `pointerdown → mousedown → blur (the edit commits and clears its state) → mouseup → click → onInteractOutside`. Use `useInlineEditGuard(active)` (`src/lib/hooks/use-inline-edit-guard.ts`), which snapshots the flag on a capture-phase `pointerdown`, and read that ref in `onInteractOutside`.
    - This replaced `useDismissGuard`'s `suppressNext()`, which required every inline edit to call it from *both* `onBlur` and its Escape branch — a rule that was broken more than once. Inline edits are now plain; the knowledge lives in the modal.
- **`useDismiss` survives for one case only**: an inline region that closes on outside click but is *not* a Radix layer — the six filter panels (`Collapsible` handles their open state and aria, `useDismiss` their outside-click) and the disclosure forms in `create-debt-form.tsx`/`create-payment-form.tsx`/`editable-person-header.tsx`. Radix has no primitive for this (Popover floats in a portal, which would change these layouts). It carries two guards for coexisting with Radix layers, both load-bearing:
  - It stands down while `document.body.style.pointerEvents === "none"` — an open Select/Dialog takes pointer events away from the page, so the following click hit-tests to `<html>` and would otherwise read as "outside", resetting the form around an open dropdown.
  - It ignores an Escape whose `defaultPrevented` is already set. DismissableLayer marks the key handled that way but deliberately does not `stopPropagation`, so it still reaches this window-level listener. This replaced the old `escapeCapture` option.
  - It compares against `event.composedPath()`, not `event.target`: a click that unmounts its own node (choosing a dropdown option) leaves `event.target` detached by the time a `document`-level listener runs, so `contains(event.target)` wrongly reads as "outside". `composedPath()` is captured at dispatch time and is immune to later DOM mutation.
- **`MethodSelect` keeps a hidden `<input>` and must not use `Select.Root`'s `name` prop.** Radix's hidden native `<select>` only emits an empty option when the value is `undefined`; this component models "nothing chosen" as `""`, and a native select whose value matches no option selects its *first* one — so `formData.get("debtMethod")` would return `"PIX"` for an unset method in every server action. `src/components/method-select.test.tsx` locks this.

## Deployment

- **Region**: `vercel.json` pins every Vercel function to `gru1` (São Paulo), co-located with the Neon Postgres database (also São Paulo) — the project used to run on the platform default (`iad1`, Virginia), which meant every query crossed the continent twice. Confirmed via Speed Insights: FCP/LCP dropped from 2.85s to ~0.94s (P75) after the move. If the Neon database's region ever changes, update this to match.
- **`prisma migrate deploy` runs as part of the build**: `package.json`'s `build` script is `prisma migrate deploy && next build`, not just `next build`. This exists because a migration (`publicVisible` on `Person`) once shipped in this repo and worked locally for days without ever being applied to the production Neon database, causing a full outage (`P2022: column does not exist` on every request). Migrations now apply automatically on every deploy, using the real `DATABASE_URL` that's only available inside Vercel's own build environment — `vercel env pull` cannot retrieve it locally (Neon's Vercel integration stores it as a build/runtime-only reference, not a plain value), so don't assume you can reproduce the exact production connection string outside of a Vercel deploy. CI's `test` job runs the same `npm run build` against a real ephemeral `postgres:16` service (see "Testing conventions") specifically so this class of bug gets caught before merge, not after deploy.
- **`src/lib/prisma.ts` normalizes `sslmode`**: Neon's connection string sets `sslmode=require` (or similar), which `pg`/`pg-connection-string` currently treats as an alias for `verify-full` but warns will require the explicit mode in a future major version. The adapter construction rewrites `prefer`/`require`/`verify-ca` to `verify-full` before use; local dev's `DATABASE_URL` has no `sslmode` param at all (unencrypted local Postgres) and passes through unchanged.

## Environment variables

Every new variable must also be added to `.env.example` with a placeholder value.

```env
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=              # generate with: openssl rand -base64 33 (npx auth secret now installs the unrelated Better Auth CLI)
NEXT_PUBLIC_APP_URL=
OLLAMA_BASE_URL=          # any OpenAI-compatible chat completions API for LLM statement extraction —
                          # local Ollama (e.g. http://localhost:11434/v1) in dev, or a hosted provider's
                          # endpoint (e.g. Groq: https://api.groq.com/openai/v1) in production;
                          # empty = algorithmic-only, no error
OLLAMA_MODEL=             # defaults to hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q8_0 if unset
OLLAMA_API_KEY=           # only needed when OLLAMA_BASE_URL points at a hosted provider that requires
                          # an Authorization: Bearer header (e.g. Groq); unused/no header sent for local Ollama
```

## Rules

- **`Person.id` never crosses the server→client boundary.** The client-facing identifier for a
  person is always their `accessCode` — in the route (`/person/[code]`, `/public/[code]`), in
  component props, in hidden form inputs (`name="accessCode"` / `name="personAccessCode"`), and in
  any server-action payload. Actions translate code → internal id inside the ownership lookup they
  already performed (`findFirst({ where: { accessCode, userId } })`), then use `person.id` for the
  FK write. `PersonWithBalance`/`PersonSummary` deliberately have no `id` field so a client
  component can't receive one by accident. A stray `personId` under `src/components`, `src/app` or
  `src/lib/hooks` is the tell that something regressed.
- **Never persist derived data** — balances are always computed at runtime.
- **PaymentMethod enum** is `PIX | CASH` only — never `CREDIT_CARD`.
- **Every new env var** must also be added to `.env.example`.
- **Design:** HUD/monochromatic (grayscale, no accent colors, no emojis). Use uppercase text instead of icons — no icons anywhere in the app, full stop (`"HIDE"` not `👁`, `"Fechar"` not `✕`, `"COPIADO"` not `"COPIADO ✓"`). This includes edit/delete affordances on list rows: no pencil/cross icon buttons, the whole row is a click target that opens a detail modal (view → edit → delete in one place; see `debt-detail-modal.tsx`/`payment-detail-modal.tsx`). Sort-direction indicators use `+`/`-` (ascending/descending), not arrow glyphs (`↑`/`↓`). Light bg is `#e8e8ed`, not white. Dark/light toggle exists — the toggle's own label text (e.g. "Tema escuro") is itself the full click target, not a separate static "Tema" label next to a smaller button. **The UI is in Brazilian Portuguese** — all labels, placeholders, buttons, and messages must be in pt-BR.
- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.).
- **Never deploy** without the admin reviewing the feature first.
- **Keep it simple** — this is a single-admin personal app; avoid overengineering.
- **Validate all inputs with Zod** — never use `as string` casts on FormData; always parse with an explicit schema. Use `formData.get("field") ?? undefined` when the field is optional so Zod's `.default()` fires correctly.
- **Zod v4 formats** — use `z.email()` (standalone), not the deprecated `z.string().email()`.
