# Debt Tracker

Aplicação pessoal para controlar dívidas de terceiros. Cada devedor recebe um código de acesso e pode consultar o próprio saldo de forma independente.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **PostgreSQL** (Docker local / Neon em produção)
- **Prisma 7** — ORM com migrations
- **Auth.js v5** — autenticação por credenciais
- **Tailwind CSS 4** — design HUD/monocromático, dark/light mode
- **Resend** — envio de e-mails (recuperação de senha)
- **Vitest** — testes unitários
- **Playwright** — testes E2E

## Pré-requisitos

- Node.js 20+
- Docker (para o PostgreSQL local)
- Conta no [Resend](https://resend.com) com domínio verificado

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Preencher DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, etc.

# 3. Subir o banco de dados
docker compose up -d

# 4. Rodar migrations e gerar o client Prisma
npx prisma migrate dev
npx prisma generate

# 5. Criar o usuário admin
npx tsx prisma/seed.ts

# 6. Iniciar o servidor de desenvolvimento
npm run dev
```

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor Next.js em modo desenvolvimento |
| `npm test` | Vitest em watch mode |
| `npm run test:run` | Vitest execução única |
| `npm run test:coverage` | Cobertura de testes |
| `npm run test:e2e` | Playwright E2E (requer `npm run dev` rodando) |
| `npm run test:e2e:ui` | Playwright com interface visual |
| `npm run test:all` | Vitest + Playwright em sequência |
| `npm run build` | Build de produção |

## Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/` | Admin | Dashboard geral com estatísticas |
| `/person/[id]` | Admin | Detalhes de um devedor específico |
| `/public` | Público | Formulário para consulta por código |
| `/public/[code]` | Público | Acesso direto sem digitar código |
| `/login` | Público | Autenticação |
| `/forgot-password` | Público | Recuperação de senha |
| `/reset-password/[token]` | Público | Redefinição de senha |

## Testes

```bash
# Unitários (Vitest) — sem banco, tudo mockado
npm run test:run

# E2E (Playwright) — requer dev server rodando em outra aba
npm run dev          # aba 1
npm run test:e2e     # aba 2
```

Os testes E2E criam um usuário de teste isolado (`e2e@debt-tracker.test`) e removem todos os dados ao final.

## Variáveis de ambiente

Veja `.env.example` para todas as variáveis necessárias.
