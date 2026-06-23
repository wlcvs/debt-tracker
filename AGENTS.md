# debt-tracker

A fullstack web app for the admin (Wallacy) to track debts that other people owe him. Debtors can check their own balance through a public link using an `accessCode`.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15+ (TypeScript, App Router) |
| Database | PostgreSQL — Docker locally / Neon in production |
| ORM | Prisma 7 (client generated at `src/generated/prisma`) |
| Auth | Auth.js v5 (next-auth) — Credentials provider + JWT session |
| Styles | Tailwind CSS 4 |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Email | Resend — domain `wlcsv.dev`, sender `noreply@wlcsv.dev` |
| Validation | Zod |

---

## Relevant directory structure

```
src/
  app/
    (dashboard)/          # protected admin routes (route group)
      person/[id]/        # debtor details
    public/[code]/        # debtor read-only view via accessCode
    debtor/login|register # debtor authentication
    login/                # admin authentication
    forgot-password/
    reset-password/[token]/
    account/
    api/
      auth/[...nextauth]/
      notifications/      # POST and GET (separate service, authenticated via NOTIFICATIONS_SECRET)
  lib/
    prisma.ts             # PrismaClient singleton
    debt-allocation.ts    # visual allocation algorithm (payments → debts)
    email-notifications.ts
    rate-limit.ts
    payment-methods.ts
  auth.ts                 # main Auth.js configuration
  auth.config.ts          # jwt/session callbacks (also read by Edge middleware)
  proxy.ts                # Edge middleware
e2e/                      # Playwright tests
prisma/
  schema.prisma
  seed.ts
```

---

## Prisma models

```
User           — admin; owns People and CreditCards
Person         — debtor; fields: name, email?, passwordHash?, phone?, emailNotifications, accessCode (unique)
CreditCard     — admin's card; referenced in Debt
Debt           — amount (Decimal 10,2), description, date, creditCardId?
Payment        — amount, date, method (PIX | CASH), debtId? (optional — links to a specific debt)
PasswordResetToken — unique token, expiresAt, cascade with User
```

`PaymentMethod` enum: `PIX`, `CASH` — never `CREDIT_CARD` (payments are never made on the card itself).

---

## Authentication

- **Admin:** Auth.js Credentials. JWT session with role `admin` injected in `auth.config.ts` (jwt/session callbacks).
- **Debtor:** separate session at `/debtor/*`. Public access via `accessCode` at `/public/[code]` requires no login.
- **Edge middleware:** `src/proxy.ts` reads the session via `auth.config.ts`; protects `(dashboard)` routes.
- **Seed:** `prisma/seed.ts` creates the admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

---

## Environment variables

Every new variable must also be added to `.env.example` with a placeholder value.

```env
DATABASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
AUTH_SECRET=                 # generate with: npx auth secret
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
NOTIFICATIONS_SECRET=        # random secure string to authenticate the notifications service
```

---

## npm scripts

```
dev             # dev server
build / start   # production
lint
test            # Vitest (watch)
test:run        # Vitest (once)
test:coverage
test:e2e        # Playwright headless
test:e2e:ui     # Playwright with UI
test:all        # unit + e2e
```

---

## Code conventions

- **Commits:** Conventional Commits in English (`feat:`, `fix:`, `chore:`, etc.)
- **Unit tests:** `src/lib/__tests__/` — Vitest, Prisma mocked
- **E2E tests:** `e2e/` — Playwright; global setup in `e2e/global-setup.ts`
- **No emojis** in UI or code — use uppercase text instead (e.g. `"HIDE"` not an emoji)
- **API routes** return JSON; errors use correct HTTP status codes
- **Notifications** are fire-and-forget — never block the action response

---

## Visual allocation algorithm

`src/lib/debt-allocation.ts` — payments cover debts sorted by amount ASC (smallest first). The result is purely visual/derived and is never persisted to the database.

---

## Design

HUD/monochromatic aesthetic inspired by ALLMIND (Armored Core VI) and Death Stranding: grayscale, thin lines, technical panel feel. Dark/light mode toggle, responsive (mobile-first, hamburger drawer). Light background uses `#c8c8d0`, not pure white.

---

## Rules for agents

- Never deploy without Wallacy reviewing the feature first.
- Always add new env vars to `.env.example`.
- Never use `CREDIT_CARD` as a `PaymentMethod`.
- Keep the monochromatic aesthetic — no accent colors, no emojis.
- Never persist derived data (balances, allocations) — always compute at runtime.
- Write no comments unless the "why" is non-obvious; never write obvious or descriptive comments.
