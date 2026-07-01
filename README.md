# FinFam · Gestão Financeira Familiar

Aplicativo de gestão financeira familiar de alto nível. Construído com **React +
Vite + TypeScript**, estilizado com **Tailwind CSS** e com backend (banco de
dados e autenticação) no **Supabase**. Deploy alvo: **Vercel**.

## Stack

- **React 18 + TypeScript** + **Vite** — SPA rápida, moderna e tipada.
- **Tailwind CSS** — estilização utilitária com paleta personalizada da marca.
- **Supabase** — Postgres + Auth (Google OAuth) + Row Level Security.
- **React Router** — roteamento e rotas protegidas.

## Acesso restrito (convite + Google)

A aplicação é **fechada e controlada pelo administrador da família**:

- **Login exclusivo via Google** (OAuth). Não há senha local.
- **Whitelist**: só entra quem foi previamente convidado pelo Admin. E-mails não
  autorizados veem uma tela amigável de "preciso de convite".
- **Painel de administração** (`/admin`, somente Admin): convidar e-mails,
  definir Admin/Member e **revogar acesso instantaneamente** (o RLS corta o
  acesso na hora).
- O **primeiro** usuário a entrar vira Admin automaticamente (bootstrap).

Detalhes do modelo em [`supabase/README.md`](supabase/README.md).

## Arquitetura

O projeto segue os princípios de **Clean Architecture**, com dependências
sempre apontando "para dentro" (UI → serviços → domínio → infraestrutura):

```
src/
├── config/        # Leitura validada de variáveis de ambiente
├── lib/           # Infraestrutura (cliente Supabase, tipos do banco) e utilitários
├── domain/        # Núcleo: entidades, mapeadores e constantes (sem dependências externas)
│   ├── constants.ts
│   └── entities/  # User, Category, Transaction (+ mapeadores snake_case ↔ camelCase)
├── services/      # Camada de dados: 1 serviço por agregado + auth (consome o Supabase)
├── context/       # AuthProvider (sessão, perfil e estado de autorização)
├── hooks/         # useAuth e demais hooks de apresentação
├── routes/        # AppRoutes + ProtectedRoute (com guarda de admin)
├── components/ui/ # Componentes de UI reutilizáveis
└── pages/         # Login, Dashboard, AdminDashboard, NeedInvite, 404
```

**Princípios aplicados:**

- A UI nunca importa `@supabase/supabase-js` diretamente — só a camada de
  `services`. Trocar de backend exige mudar apenas `lib/` e `services/`.
- Linhas do banco (snake_case) são convertidas para entidades de domínio
  (camelCase) por mapeadores tipados em `domain/entities`.
- Tratamento de erros centralizado em `services/serviceError.ts`.
- O schema do banco é tipado em `lib/database.types.ts`, dando segurança de
  tipos de ponta a ponta nas consultas.

## Paleta de cores (Tailwind)

Definida em [`tailwind.config.js`](tailwind.config.js) sob o namespace `brand`:

| Classe          | Hex       | Uso                              |
| --------------- | --------- | -------------------------------- |
| `brand-gray`    | `#8C888A` | Texto / elementos neutros        |
| `brand-aqua`    | `#9BBFB5` | Destaques / valores positivos    |
| `brand-moss`    | `#6D7368` | Secundário / bordas              |
| `brand-cream`   | `#F1F2CE` | Avisos / fundos de destaque      |
| `brand-light`   | `#F2F2F2` | Background principal             |

Exemplos: `bg-brand-light`, `text-brand-gray`, `border-brand-moss`,
`bg-brand-aqua`, `bg-brand-cream`.

## Começando

### 1. Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Uma conta e um projeto no [Supabase](https://supabase.com)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie o exemplo e preencha com as credenciais do seu projeto
(**Supabase → Project Settings → API**):

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

> Use **apenas** a chave pública `anon`. Nunca exponha a `service_role`.

### 4. Provisionar o banco de dados e o login Google

Execute os scripts de [`supabase/migrations`](supabase/migrations) na ordem
numérica **e** configure o provedor Google (ativar Google, desativar Email).
Passo a passo em [`supabase/README.md`](supabase/README.md).

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

## Scripts

| Comando             | Descrição                            |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento (Vite)   |
| `npm run build`     | Type-check + build de produção       |
| `npm run preview`   | Pré-visualiza o build localmente     |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`)   |
| `npm run lint`      | Análise estática (ESLint)            |

## Deploy na Vercel

Guia completo (variáveis de ambiente, Redirect URLs do Supabase e OAuth do
Google para local/preview/produção) em **[`DEPLOY.md`](DEPLOY.md)**.

Resumo:

1. Importe o repositório na Vercel (framework detectado: **Vite**).
2. Em **Settings → Environment Variables**, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Production, Preview e Development).
3. No Supabase (**Authentication → URL Configuration**), configure *Site URL* e
   *Redirect URLs* (incluindo o wildcard de preview `https://SEU-PROJETO-*.vercel.app/**`).
4. No Google Cloud, cadastre o *redirect URI* do callback do Supabase.
5. Deploy. O [`vercel.json`](vercel.json) já cuida do rewrite de SPA e do cache
   dos assets.
