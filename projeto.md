# Projeto: Controle de Dívidas e Empréstimos Pessoais

**Nome do projeto (código):** `debt-tracker`

## 1. Levantamento de Requisitos

### 1.1 Tipo de Projeto
- Aplicação web

### 1.2 Estágio da Ideia
- Problema identificado, sem solução definida ainda

### 1.3 Objetivo
- Construir algo real, utilizável no dia a dia e que sirva como peça de portfólio

### 1.4 Problema (Dor)
Wallacy empresta dinheiro a várias pessoas de formas diferentes (uso do cartão de crédito,
Pix de crédito, etc.) e perde o controle de quem deve quanto e quanto cada pessoa já pagou
de volta (pagamentos parciais).

**Decisão de escopo:** o sistema serve **exclusivamente para acompanhar dívidas que outras
pessoas têm com Wallacy** (terceiros devendo a ele). Dívidas próprias de Wallacy (gastos
pessoais, faturas próprias etc.) ficam **fora do escopo** deste sistema, para não desviar
do propósito principal.

### 1.5 Stakeholders / Usuários
- **Administrador (Wallacy)**: usuário principal, gerencia todas as dívidas, pessoas, pagamentos.
- **Devedor (visualização)**: pessoa que deve dinheiro; acessa via código de acesso individual
  (sem login completo), com permissão somente leitura, vendo apenas seus próprios dados
  (valor devido, histórico de pagamentos).

### 1.6 Referências de Produto
- Nenhuma referência de app conhecida (não encontrou solução pronta no mercado).
- Tentativa anterior: controle manual via Obsidian e Excel — ficou desorganizado e
  gerava procrastinação para manter atualizado (motivador chave para construir um sistema próprio).

---

## 2. Especificação de Requisitos

### 1.7 Dados de uma Dívida
- Valor
- Data
- Motivo/descrição (ex: "Pix de crédito", "uso do cartão")
- Pessoa associada (devedor)
- *(Juros/prazo não se aplicam diretamente à dívida — ver 1.8)*

### 1.8 Dor adicional: Múltiplos Cartões de Crédito
Wallacy possui vários cartões de crédito. Quando uma dívida de terceiro é feita através de um
cartão, isso adiciona complexidade ao controle.

**Escopo definido:** o sistema, por enquanto, apenas permite **marcar/associar qual cartão foi
usado** em uma dívida (campo simples de referência/etiqueta), sem gerenciar limite, fatura,
vencimento, etc. Esse controle completo de cartões será um sistema futuro separado, a ser
integrado com este projeto mais adiante. Não é necessário projetar a integração agora, apenas
manter o dado do cartão estruturado o suficiente para facilitar isso no futuro (ex: cartão como
entidade própria, não apenas texto livre).

### 1.9 Modelo de Pagamentos
- Pagamentos são registrados como **abatimento do saldo total devido por uma pessoa**, não
  vinculados explicitamente a uma dívida específica.
- Indicação visual: conforme o total pago por uma pessoa se acumula, as dívidas dessa pessoa
  vão sendo marcadas como "pagas" (ex: cor verde) na ordem em que cabem dentro do valor pago,
  sem que o sistema (ou o usuário) precise escolher manualmente qual dívida corresponde a qual
  pagamento. É uma alocação automática apenas para fins visuais/indicativos.
- Critério de ordem de alocação: **menor valor primeiro** (não é por data).

#### Algoritmo de Alocação Visual (definido pelo usuário)
```
function aplicarFlagsPagamento(dividasNaoPagas, valorPago):
    // dividasNaoPagas: lista de dívidas SEM a flag "paga", ordenada por valor ASC
    // valorPago: valor recebido da pessoa (usado como cópia local, não muta o original)

    restante = copiar(valorPago)

    para cada divida em dividasNaoPagas (em ordem crescente de valor):
        se restante >= divida.valor:
            divida.flagPaga = true   // passa a ser exibida em verde
            restante = restante - divida.valor
        senão:
            // valor insuficiente para esta dívida (e logo, para as próximas, já que estão
            // em ordem crescente) — pode interromper o loop aqui (otimização)
            parar loop

    retornar restante  // não utilizado para nada além do cálculo, não é persistido por dívida
```

**Observações importantes:**
- A lista de dívidas **não-pagas** de uma pessoa deve estar ordenada por valor crescente para
  que o algoritmo possa parar antecipadamente (early exit) quando o valor restante não cobre
  mais a próxima dívida (já que todas as seguintes são maiores ou iguais).
- A flag de "paga" é **apenas visual/indicativa** — não significa que aquele pagamento específico
  foi destinado a aquela dívida; é só uma forma de mostrar progresso.
- O valor restante (`restante`) não precisa ser persistido por dívida; o que importa
  persistido é o **saldo total devido pela pessoa** (soma das dívidas não pagas) e o
  **total pago** por ela.
- Esse cálculo de flags pode ser feito em tempo de exibição (derivado), não precisa
  necessariamente ser armazenado no banco — a ser decidido na fase de arquitetura.
- **⚠️ Ponto crítico (evitar bug):** o parâmetro `valorPago` passado para o algoritmo deve
  ser **sempre o somatório de TODOS os pagamentos já feitos por aquela pessoa** (soma de todos
  os registros `Payment` dela), nunca o valor de um pagamento isolado/recente. O algoritmo deve
  ser recalculado do zero a cada exibição, usando esse total acumulado. Como cada `Payment` já
  fica persistido individualmente no banco, a soma total nunca se perde — não há necessidade
  (nem é correto) persistir o "restante" entre execuções.
- **Decisão final:** cálculo será **derivado** (recalculado a cada exibição), não persistido.
  Justificativa: custo computacional é insignificante (O(n log n) numa lista pequena de
  dívidas por pessoa), enquanto persistir a flag traria complexidade real de manutenção
  (reprocessar em toda edição/exclusão de pagamento, risco de dessincronização). Princípio
  aplicado: YAGNI — evitar otimização prematura sem ganho real medido.

### 1.10 Preferência de UX/Design
- Usuário é pragmático: prefere **o mínimo de telas possível**.
- Interface principal deve ser um **dashboard único**, denso e direto, reunindo as
  informações essenciais (visão geral + ações principais) sem navegação desnecessária.
- Evitar fluxos multi-tela quando uma única tela bem organizada resolver.

### 1.11 Conteúdo do Dashboard
- Total geral a receber (soma de todas as dívidas não pagas de todas as pessoas)
- Lista de pessoas com saldo devedor (ordenável, ex: quem deve mais primeiro)
- Indicador visual por dívida (verde = cobre pelo valor já pago, conforme algoritmo da seção 1.9)
- Formulário rápido inline para nova dívida e novo pagamento, sem sair da tela
- Busca/filtro rápido por nome da pessoa
- Acesso para gerar/visualizar o código de acesso de cada pessoa
- Indicador de pessoa "quitada" (saldo zerado)
- *(novas ideias podem ser adicionadas pelo usuário ao longo do projeto)*

### 1.12 Autenticação (Administrador)
- Login com e-mail e senha
- Recuperação de senha via e-mail

### 1.13 Backlog de Features Futuras (fora do MVP)
- Notificações para os devedores quando:
  - Uma nova dívida é adicionada
  - Um pagamento é registrado (quanto já pagou / quanto falta)
- Isso exigiria coletar mais dados de contato dos devedores (e-mail, telefone, etc.),
  o que não é necessário agora. Por enquanto o foco é só visão geral via código de acesso.

### 2.1 Stack Tecnológica (decisão final)
- **Frontend + Backend:** Next.js (TypeScript) — fullstack no mesmo projeto
- **Banco de Dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** Auth.js (NextAuth) v5 — autenticação via **Credentials Provider**,
  validando diretamente contra a tabela `User` já existente (sem usar `@auth/prisma-adapter`
  para gerenciar tabelas de sessão/conta, já que há um único usuário admin e o fluxo é simples)
- **Estilização:** Tailwind CSS

### 2.2 Ambiente de Desenvolvimento e Deploy
- **Desenvolvimento local:** PostgreSQL via Docker (no ThinkPad, CachyOS)
- **Produção (futuro):** Vercel (app) + Neon ou Supabase (Postgres gerenciado, tier gratuito)
- Sem necessidade de infraestrutura complexa nesta fase inicial

## 3. Arquitetura

### 3.1 Modelo de Dados (Entidades e Relações)

**Entidades:**
- **User** (admin): `id`, `email`, `passwordHash` — usuário único do sistema (Wallacy)
- **Person** (devedor): `id`, `userId` (FK → User), `name`, `accessCode` (único, para acesso
  de visualização)
- **CreditCard**: `id`, `userId` (FK → User), `label` (ex: "Nubank", "Inter") — apenas
  referência simples, sem controle de limite/fatura por enquanto
- **Debt** (dívida): `id`, `personId` (FK → Person), `creditCardId` (FK → CreditCard,
  opcional/nullable), `amount`, `description`, `date`
- **Payment** (pagamento): `id`, `personId` (FK → Person), `amount`, `date` — abate o saldo
  total da pessoa, sem vínculo direto com uma Debt específica

**Relações:**
- User 1 — N Person
- User 1 — N CreditCard
- Person 1 — N Debt
- Person 1 — N Payment
- CreditCard 1 — N Debt (opcional)

**Glossário rápido:**
- **PK** (Primary Key): identificador único de cada linha de uma tabela
- **FK** (Foreign Key): campo que referencia o `id` de outra tabela, criando o vínculo
  relacional entre elas (ex: `Debt.personId` aponta para `Person.id`)

### 3.2 Acesso do Devedor (visualização)
- Página fixa de consulta (ex: `/consultar`) com campo para a pessoa digitar o `accessCode`
  manualmente.
- Decisão: **não** usar o código diretamente na URL (evita links "poluídos"); a pessoa digita
  o código na página.

### 3.3 Direção Visual / Design
- Referência principal: logo da ALLMIND (Armored Core VI) — geometria simples (triângulo),
  paleta monocromática em cinza/branco, tipografia técnica, visual "emblema/HUD militar".
- Inspiração de interface: HUDs de **Armored Core** e **Death Stranding** — linhas finas,
  grids, leiaute técnico, bastante espaço negativo, sensação de "painel de sistema", não de
  app comercial colorido.
- Estilo geral: minimalista, linhas simples e diretas, cinza com efeito de blur, branco.
- Referências adicionais de web design (anos 2000, estética técnica/geométrica) salvas como
  inspiração — ver lista de links fornecida pelo usuário (Web Design Museum).
- Implicação prática: paleta majoritariamente em escala de cinza. **Decisão:** dívidas
  "cobertas pelo pagamento" usam **branco** como indicador (em vez de verde), mantendo a
  estética monocromática. Cor é reservada apenas para acentos críticos (a definir caso
  surja necessidade real, ex: alerta de erro).

## 4. Planejamento

### 4.1 Etapas de Implementação (MVP)

1. **Setup do projeto**
   - Criar projeto Next.js (TypeScript)
   - Configurar PostgreSQL local via Docker
   - Configurar Prisma e conectar ao banco

2. **Modelagem do banco de dados**
   - Criar schema Prisma com as entidades definidas (User, Person, CreditCard, Debt, Payment)
   - Rodar a primeira migration

3. **Autenticação do administrador**
   - Configurar Auth.js (login com e-mail/senha)
   - Implementar recuperação de senha por e-mail

4. **CRUD básico (camada de dados/backend)**
   - Criar, listar, editar e excluir: pessoas, dívidas, pagamentos, cartões

5. **Dashboard principal (UI)**
   - Tela única com lista de pessoas, saldos, formulários inline
   - Implementar o algoritmo de alocação visual (cálculo derivado)

6. **Acesso do devedor (visualização)**
   - Geração de `accessCode` por pessoa
   - Página `/consultar` com validação do código e exibição somente-leitura

7. **Refinamento visual**
   - Aplicar a estética HUD/monocromática (referências ALLMIND, Armored Core, Death Stranding)

8. **Deploy**
   - Subir para Vercel + banco gerenciado (Neon ou Supabase)

### 4.2 Fora do MVP (backlog)
- Notificações automáticas para devedores (ver seção 1.13)
- Integração futura com sistema de gerenciamento de cartões de crédito

## 5. Codificação

### 5.1 Status Atual (progresso até o momento)

**Concluído:**
- ✅ Etapa 1 (Setup): projeto Next.js criado (`debt-tracker`, TypeScript, Tailwind, App Router,
  `src/`, sem React Compiler, sem AGENTS.md), repositório GitHub conectado.
- ✅ Etapa 2 (Banco): PostgreSQL via Docker (`docker-compose.yml`), Prisma configurado
  (versão 7.x — usa `provider = "prisma-client"` com output em `src/generated/prisma`,
  exige driver adapter `@prisma/adapter-pg`), schema com os 5 modelos criado e migration
  inicial aplicada.
- ✅ Etapa 3 (Autenticação): Auth.js v5 com Credentials Provider configurado. Separação entre
  `src/auth.config.ts` (config leve, sem Prisma/bcrypt, usada no middleware/Edge) e
  `src/auth.ts` (config completa, usada nas Server Actions/API). Login funcionando.
  Script de seed do usuário admin (`prisma/seed.ts`, lê `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  do `.env`, configurado via `prisma.config.ts` → `migrations.seed`).
  **Correção aplicada:** callbacks `jwt`/`session` adicionados em `src/auth.ts` para propagar
  `user.id` para a sessão (não vem por padrão), com type augmentation em
  `src/types/next-auth.d.ts`.
- 🔄 Etapa 4 (CRUD): em andamento.
  - `src/lib/debt-allocation.ts` → função pura `calculateCoveredDebtIds` (algoritmo de
    alocação visual, testável isoladamente, sem dependência de Prisma/banco).
  - `src/lib/actions/person.ts` → `createPerson`, `getPeopleWithBalances` (usa a função de
    alocação para marcar `isCovered` em cada dívida).
  - `src/lib/actions/debt.ts` → `createDebt` (com validação Zod e checagem de
    autorização — pessoa deve pertencer ao usuário logado).
  - `src/lib/actions/payment.ts` → `createPayment` (mesmo padrão de `createDebt`).
  - `src/lib/actions/credit-card.ts` → `createCreditCard`, `getCreditCards`.
  - `src/lib/actions/auth.ts` → `signOutAction`.
  - Ainda **faltam**: update/delete de Person, Debt, Payment, CreditCard (só "create" e
    "list" foram feitos até agora, suficiente para o fluxo principal do MVP).
- 🔄 Etapa 5 (Dashboard): versão inicial funcional em `src/app/page.tsx`, **sem estilização**
  (HTML puro, sem Tailwind aplicado ainda) — serve para validar a lógica antes de aplicar
  o visual definitivo. Inclui: total a receber, formulário de nova pessoa, formulário de
  novo cartão, lista de pessoas com dívidas/pagamentos inline e indicador visual temporário
  (`opacity: 0.5`) para dívidas cobertas.

**Pendente (próximos passos):**
- Etapa 6: página `/consultar` (acesso do devedor via accessCode)
- Etapa 7: refinamento visual completo com Tailwind, aplicando a estética HUD/monocromática
  (ver seção 3.3) — incluindo trocar o indicador temporário de opacity por algo definitivo
  em branco, conforme decidido
- Recuperação de senha por e-mail (mencionada no requisito 1.12, ainda não implementada)
- Etapa 8: Deploy (Vercel + Neon/Supabase)
- CRUD completo (update/delete) de todas as entidades, se necessário além do MVP

### 5.2 Notas Técnicas Importantes (decisões/correções feitas durante a codificação)
- Prisma 7 requer driver adapter (`@prisma/adapter-pg` + `pg`) — client não funciona só com
  `DATABASE_URL` no `.env` como em versões antigas.
- `src/middleware.ts` usa apenas `src/auth.config.ts` (não importa `src/auth.ts` diretamente),
  porque o middleware roda no Edge Runtime, que não suporta APIs Node usadas por
  Prisma/bcryptjs (erro `node:path` se misturado).
- Validação de formulários via Zod, com `z.coerce` para converter strings de `FormData` em
  números/datas.
- Toda Server Action que lida com dados de uma `Person` específica valida que
  `person.userId === session.user.id` antes de operar (autorização em nível de dados).

## 6. Convenções de Desenvolvimento

### 6.1 Controle de Versão (Git/GitHub)
- Repositório Git local criado automaticamente pelo `create-next-app`.
- Repositório remoto no GitHub (privado), conectado via `git remote add origin`.

### 6.2 Padrão de Commits (Conventional Commits)
**Idioma:** mensagens de commit em inglês (assim como o código e nomes do projeto).

Formato: `tipo: descrição curta no imperativo`

Tipos usados:
- `feat:` → nova funcionalidade
- `fix:` → correção de bug
- `chore:` → tarefas de manutenção/configuração, sem mudar comportamento
- `docs:` → mudanças em documentação
- `refactor:` → reorganização de código sem mudar comportamento
- `style:` → formatação/visual, sem lógica

Regra de ouro: **um commit = uma mudança lógica coesa** (não comitar a cada linha; comitar
quando uma ideia/etapa estiver fechada).
