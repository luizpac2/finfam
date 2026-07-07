# FinFam — guia da arquitetura (para agentes)

App de **gestão financeira familiar**. Fechado por convite, login **só via Google**.
Idioma da UI: **PT-BR**. Deploy: Vercel. Backend: Supabase (Postgres + Auth + RLS).

> Objetivo deste arquivo: dar o mapa completo para trabalhar sem reexplorar tudo.
> Ao mudar arquitetura/tabelas/regras, **atualize este arquivo**.

## Stack

- **React 18 + TypeScript + Vite 6**. Tailwind CSS v3 (paleta custom).
- **Supabase JS v2** (auth Google OAuth, Postgres, RLS). Só a chave `anon`.
- **React Router v6**, **Recharts** (lazy), **pdfjs-dist** (lazy), **lucide-react**.

## Comandos

```bash
npm run dev        # Vite dev server (localhost:5173)
npm run build      # tsc --noEmit && vite build   (Vercel roda isto)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
```

Sempre rode **typecheck + lint + build** antes de commitar. Testar funções puras
de domínio: `node --experimental-strip-types` num `.mts` que importa o `.ts` por
`file://` (só funciona se o alvo tiver apenas imports type-only externos).

## Arquitetura (Clean Architecture — dependências apontam para dentro)

```
src/
├── config/env.ts          # leitura validada de import.meta.env (VITE_*)
├── lib/                    # infra + utilitários puros
│   ├── supabaseClient.ts   # ÚNICO lugar que importa @supabase/supabase-js
│   ├── database.types.ts   # tipos do schema (escritos à mão) — fonte de verdade dos tipos DB
│   ├── categoryIcons.tsx   # mapa nome→ícone lucide + <CategoryIcon>
│   ├── fileParser.ts       # parsers OFX/OFC/CSV/TXT/PDF → ParsedTransaction[]
│   └── format.ts           # formatCurrency, formatCurrencyAccounting (contábil), formatDate
├── domain/                 # núcleo puro (sem deps externas além de tipos)
│   ├── entities/           # User, Category, Transaction, CategoryRule (+ mappers snake↔camel)
│   ├── constants.ts        # enums/labels (tipos, status, kinds)
│   ├── categorizationEngine.ts # heurística por palavra-chave → categoria (dicionário)
│   ├── ruleEngine.ts       # regras do usuário: ruleMatches(keyword+amount), applyUserRules
│   ├── duplicateDetection.ts   # detecção de duplicatas na importação
│   ├── installments.ts     # detecção de parcelas (N/M) na descrição + agrupamento por compra
│   ├── analytics.ts / dashboardAnalytics.ts # agregações puras p/ gráficos
├── services/               # data access: 1 serviço por agregado (consomem supabaseClient)
│   ├── authService, userService, categoryService, categoryRuleService, transactionService
│   └── serviceError.ts     # ServiceError + unwrap({data,error}, ctx)
├── context/                # AuthContext (sessão/perfil), ToastContext, ThemeContext, ReferenceDataContext (cache categorias+regras)
├── hooks/                  # useAuth, useToast, useTheme
├── routes/                 # AppRoutes (lazy) + ProtectedRoute (requireAdmin)
├── components/             # layout/ (MainLayout, Sidebar sanfonável, GlobalSearch), ui/, dashboard/, filters/, import/, transactions/
└── pages/                  # Dashboard, AnalyticsDashboard, TransactionsPage, InstallmentsPage (/parcelamentos), CardsPage (/cartoes — controle de faturas), Import, CategoriesPage, RulesPage, AdminDashboard, Login, NeedInvite, NotFound
```

**Regra de ouro:** a UI nunca importa `@supabase/supabase-js`; só a camada
`services`. Linhas do DB (snake_case) viram entidades de domínio (camelCase) via
mappers em `domain/entities`. Erros de dados passam por `unwrap()` → `ServiceError`.

## Modelo de dados (Postgres/Supabase)

Tabelas em `public`:
- **users** — perfis + whitelist. `id`, `auth_id`(→auth.users, null até login), `email`(único, ci),
  `full_name`, `role` (`admin`|`member`), `status` (`invited`|`active`|`revoked`), `avatar_url`.
- **categories** — `id`, `name`, `icon`, `color`, `kind` (`income`|`expense`|`credit_card`),
  `parent_id` (subcategorias, self-FK), `opened_at`/`closed_at` (cartão: vigente desde /
  cancelado em; ambos null = vigente sem data). Cada cartão de crédito é uma categoria `credit_card`.
- **transactions** — `id`, `date`, `description`, `amount` (sempre ≥0; sinal vem de `type`),
  `type` (`income`|`expense`), `status` (`pending`|`paid`|`cancelled`), `category_id`,
  `card_id` (→categoria do cartão, na importação de fatura), `user_id` (→users.id, o autor),
  `manual_category` (bool; `true` = categoria definida à mão → regras/auto NÃO sobrescrevem).
  ⚠️ Tem **2 FKs para categories** (`category_id` e `card_id`): no embed do PostgREST use
  `categories!category_id ( ... )` senão dá erro de ambiguidade.
- **category_rules** — regras do usuário: `keyword` (opcional), `amount` (opcional, numeric),
  `action` (`categorize`|`ignore`), `category_id`. Precisa ter palavra E/OU valor.

Tipos de domínio ficam em `lib/database.types.ts` (mantidos à mão). Ao alterar o
schema, atualize esse arquivo + os mappers + este CLAUDE.md.

## Segurança (RLS é o cerne — auditado, está sólido)

- **RLS habilitado nas 4 tabelas.** Modelo: a família COMPARTILHA a visão.
  - SELECT: `is_active_member()` (todo membro ativo lê tudo).
  - transactions INSERT: `user_id = current_profile_id()`; UPDATE/DELETE: autor ou admin.
  - categories / category_rules / users: gestão só admin (`is_admin()`); leitura por membros.
- **Funções SECURITY DEFINER** (`current_profile_id`, `current_user_role`, `is_active_member`,
  `is_admin`, `handle_new_user`, `sync_current_user`) têm `set search_path = public` (anti-hijack).
  `months_with_transactions` é SECURITY INVOKER (respeita RLS).
- **Whitelist / login:** admin cria linha em `users` (status `invited`). No 1º login Google, o
  gatilho `handle_new_user` e/ou a RPC `sync_current_user` vinculam `auth_id` e ativam. Sem
  convite → sem perfil ativo → RLS nega tudo + tela "precisa de convite". **1º usuário vira admin**.
- Client: guards de rota (`ProtectedRoute`) são só UX; a segurança real é o RLS.
  Sem `dangerouslySetInnerHTML`/`eval`; React escapa por padrão. Só chave `anon` no bundle.
- Busca (`transactionService.search`) monta filtro `.or()` do PostgREST sanitizando `,().*%`
  (impede injetar novas condições).

## Regras de negócio importantes

- **Cores:** receita = **verde** (`brand-income` #15966B), despesa = **vermelho**
  (`brand-expense` #D64550). Valores no **padrão contábil** (negativos entre parênteses) via
  `formatCurrencyAccounting`.
- **Cartão de crédito:** o pagamento da fatura no extrato do banco (categoria `credit_card`)
  **NÃO** conta em despesas/saldo (as compras da fatura já entram como despesas).
- **Importação:** OFX/OFC/CSV/TXT/PDF. Exclui automaticamente "BB Rende Fácil"/"Resgate
  Poupança" (aplicações automáticas) em TODOS os formatos. PDF do BB: valor com sinal `(+)/(-)`,
  histórico multilinha (ver `fileParser.parseStatementText`). Detecta duplicatas.
- **Extrato de cartão (modo cartão no `Import`):** a convenção de sinal varia por emissor
  (Nubank CSV: compra **positiva**; OFX de cartão: compra **negativa**). Por isso o `Import`
  descobre o "sinal de compra" pela **maioria** das linhas → compras viram despesa ligada ao
  cartão; o outro sinal é pagamento da fatura (excluído) ou estorno/crédito (mantido).
- **Parcelamento:** `domain/installments.parseInstallment` detecta a parcela (ex.: "3/10")
  na **descrição** (sem coluna nova no banco). Badge no `Import`/Transações e página
  **Parcelamentos** (`/parcelamentos`) com filtros (busca, situação, cartão, ordenação),
  agrupa por compra (mesma descrição-base + total + valor). Como o extrato repete a **data
  da compra** em toda parcela, `installmentSchedule`/`addMonths` estimam a data de cobrança
  de cada parcela (compra + (n-1) meses) e projetam as parcelas futuras.
- **Categorização automática:** regras do usuário (`ruleEngine`) têm prioridade sobre a
  heurística (`categorizationEngine`). Categorias são específicas por tipo (receita/despesa).
  A regra **só categoriza quando a categoria é do mesmo tipo do lançamento**
  (`categoryKindMatchesType`): categoria de receita não é aplicada a despesa e vice-versa
  (ex.: mesma descrição para salário recebido × compra feita no mesmo lugar).
- **Edição manual protegida:** editar a categoria à mão (editor ou edição em massa em
  Transações) marca `manual_category=true`. A aplicação de regras ao histórico (Regras) e a
  categorização automática **ignoram** esses lançamentos — não sobrescrevem o que foi curado.
  O `transactionService` é tolerante à coluna ausente (migração 0013 não aplicada): tenta com
  a flag e refaz sem ela, então um push antes da migration não perde edições.

## Migrations (rodar em ordem no SQL Editor do Supabase)

`0001` schema · `0002` funções auth/RLS · `0003` RLS · `0004`/`0005` seed categorias ·
`0006` kind+subcategorias · `0007` cartão de crédito · `0008` regras · `0009`
meses-com-lançamentos (RPC) · `0010` regras por valor · `0011` índice trigram de busca +
hardening · `0012` RPC `financial_summary` (resumo agregado no banco) · `0013`
`manual_category` (protege edição manual da aplicação de regras) · `0014`
`categories.closed_at` (cartão vigente/cancelado) + RPC `card_months` (cobertura de faturas) ·
`0015` `categories.opened_at` (cartão "vigente desde", para marcar faturas faltantes).
`supabase/reset.sql` recria do zero (fora de `migrations/`).

## Deploy (ver DEPLOY.md)

- Vercel: framework Vite; env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Prod/Preview/Dev);
  `vercel.json` faz rewrite SPA + cache de assets.
- Supabase: habilitar provider **Google**, desabilitar Email; **Site URL** + **Redirect URLs**
  (localhost + prod + wildcard de preview). Google Cloud: redirect URI = callback do Supabase.
- Repo: `github.com/luizpac2/finfam` (branch `main`). Projeto Vercel serve `finfam-one.vercel.app`.

## Convenções

- PT-BR na UI e nos comentários. Paleta `brand-*` (Tailwind). Mobile-first, layout largo
  (`max-w-[1700px]`), sidebar recolhível. Tema claro/escuro (ThemeContext).
- Ao criar página: adicionar rota lazy em `AppRoutes` + item em `MainLayout.items`
  (envolver com `<ProtectedRoute requireAdmin>` se for de admin).
- **Categorias e regras** vêm do cache `useReferenceData()` (não chame `categoryService.list`
  direto na página). Após criar/editar/excluir, chame `refreshCategories()`/`refreshRules()`.
- Commits: mensagem em PT-BR + trailer `Co-Authored-By: Claude ...`. Nunca commitar `.env.local`.
