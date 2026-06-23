## Projeto: Controle de Dívidas e Empréstimos Pessoais

**Nome do projeto (código):** `debt-tracker`

## 1. Levantamento de Requisitos

### 1.1 Tipo de Projeto
- Aplicação web

### 1.2 Estágio
- Problema identificado, sem solução definida totalmente

### 1.3 Objetivo
- Construir uma ferramenta real e utilizável, adequada para portfólio

### 1.4 Problema (dor)
Wallacy empresta dinheiro a várias pessoas por canais diferentes (uso de
cartão de crédito, Pix, etc.) e perde o controle de quem deve quanto e quanto
cada pessoa já pagou (pagamentos parciais).

**Decisão de escopo:** o sistema atende **exclusivamente ao acompanhamento
das dívidas que outras pessoas têm com Wallacy** (terceiros devendo a ele). As
dívidas pessoais do Wallacy (gastos pessoais, faturas próprias) ficam fora do
escopo.

### 1.5 Stakeholders / Usuários
- **Administrador (Wallacy):** usuário principal, gerencia pessoas, dívidas e
	pagamentos.
- **Devedor (visão pública):** pessoa que deve; acessa via código de acesso
	individual (sem login completo), apenas leitura dos próprios dados (saldo,
	histórico de pagamentos).

### 1.6 Referências
- Não há uma solução pronta adequada no mercado; tentativas anteriores foram
	feitas em Obsidian/Excel e se tornaram complicadas de manter.

---

## 2. Especificação

### 2.1 Modelo de Dados de uma Dívida
- Valor
- Data
- Descrição (ex: "Pix de crédito", "uso de cartão")
- Pessoa associada (devedor)

### 2.2 Múltiplos Cartões de Crédito
Wallacy usa vários cartões. Quando uma dívida é feita por cartão, isso adiciona
complexidade ao controle.

**Decisão de escopo:** inicialmente armazenar apenas uma referência ao cartão
usado (rótulo/entidade leve). Não gerenciar limite, fatura ou ciclos agora.

### 2.3 Modelo de Pagamentos
- Pagamentos abatrem o saldo total do devedor, não necessariamente vinculados a
	uma dívida específica.
- Alocação visual: à medida que o total pago por uma pessoa aumenta, o sistema
	marca (visualmente) dívidas como "pagas" em ordem crescente de valor. Essa
	marcação é apenas indicativa e não representa uma atribuição persistida.

#### Algoritmo de alocação (visual, não-persistido)
```
function aplicarFlagsPagamento(dividasNaoPagas, valorPago):
		restante = copiar(valorPago)
		para cada divida em dividasNaoPagas ordenadas por valor ASC:
				se restante >= divida.valor:
						divida.flagPaga = true
						restante = restante - divida.valor
				senão:
						parar
		retornar restante
```

Observações:
- A lista de dívidas não-pagas deve estar ordenada por valor crescente para
	permitir early-exit.
- A flag "paga" é apenas visual — não se deve persistir essa informação.
- O parâmetro `valorPago` deve ser sempre a soma de todos os pagamentos da
	pessoa (não o valor de um pagamento individual). O cálculo é derivado a cada
	exibição.

### 2.4 Preferências de UX
- Interface enxuta: um dashboard denso com formulários inline para criar
	dívidas/pagamentos sem navegar para telas separadas.

### 2.5 Conteúdo do Dashboard
- Total geral a receber
- Lista de pessoas com saldo devedor (ordenável)
- Indicadores visuais por dívida (coberta pelo total pago)
- Formulários inline para nova dívida e novo pagamento
- Busca/filtragem por nome de pessoa
- Geração/visualização do código de acesso por pessoa

### 2.6 Autenticação (administrador)
- Login por e-mail e senha
- Recuperação de senha por e-mail

### 2.7 Backlog (fora do MVP)
- Notificações para devedores quando:
	- nova dívida é adicionada
	- pagamento é registrado

## 3. Arquitetura

### 3.1 Entidades
- `User` (admin): `id`, `email`, `passwordHash`
- `Person` (devedor): `id`, `userId`, `name`, `accessCode`
- `CreditCard`: `id`, `userId`, `label`
- `Debt`: `id`, `personId`, `creditCardId?`, `amount`, `description`, `date`
- `Payment`: `id`, `personId`, `amount`, `date`, `method?`

### 3.2 Acesso público do devedor
- Página pública `/public` com campo para inserir `accessCode` (ou link direto
	`/public/[code]`) para visualizar apenas os dados do próprio devedor.

### 3.3 Direção visual
- Estética monocromática/HUD; indicadores visuais para progresso de pagamentos
	sem depender de cores críticas.

## 4. Plano de Implementação (MVP)

1. Inicializar projeto Next.js (TypeScript) e infra local (Postgres via Docker)
2. Modelagem Prisma + migrations
3. Implementar autenticação do admin (credenciais) e recuperação de senha
4. Endpoints/server actions: CRUD para pessoas, dívidas, pagamentos, cartões
5. Dashboard admin com algoritmo de alocação e formulários inline
6. Visão pública por `accessCode` com opção de registro de e-mail
7. Refinamento visual e deploy

## 5. Codificação e Status Atual

Até o momento há scaffold do Next.js com rotas de admin e visão pública, alguns
componentes e server actions implementados. Testes E2E básicos existem e o
fluxo principal está coberto por specs de Playwright.

## 6. Notas Operacionais

- Banco de dados: PostgreSQL local para desenvolvimento; recomenda-se Neon ou
	Supabase para produção.
- ORM: Prisma (migrations + client gerado em `src/generated/prisma`).
- Envio de e-mails: Resend (API key via `RESEND_API_KEY`).
- Testes: Vitest para unitários, Playwright para E2E.

## 7. Como rodar localmente (resumo)

```bash
# instalar dependências
npm install

# copiar env
cp .env.example .env
# configurar DATABASE_URL e outras variáveis

# subir postgres (docker)
docker compose up -d

# rodar migrations
npx prisma migrate dev
npx prisma generate

# seed (criar usuário admin)
npx tsx prisma/seed.ts

# iniciar dev server
npm run dev
```

## 8. Observações finais

- Manter a interface do usuário final em português (rótulos, placeholders,
	botões), enquanto nomes técnicos e rotas internas são padronizados em
	inglês conforme solicitado.

