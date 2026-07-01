-- =============================================================================
-- FinFam · 0001 — Esquema inicial
-- -----------------------------------------------------------------------------
-- Tipos ENUM, tabelas (categories, users, transactions), índices e gatilho de
-- `updated_at`. Execute os arquivos desta pasta em ordem numérica no SQL Editor
-- do Supabase (ou via Supabase CLI).
--
-- Modelo de whitelist: a tabela `users` funciona como lista de autorização.
-- O Admin cadastra o e-mail (status 'invited'); ao fazer login com o Google,
-- a conta é vinculada (auth_id) e ativada. Ver 0002 para a lógica de vínculo.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos ENUM do domínio
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_status') then
    -- invited = convidado (ainda não logou), active = ativo, revoked = revogado
    create type public.user_status as enum ('invited', 'active', 'revoked');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    -- income = receita, expense = despesa
    create type public.transaction_type as enum ('income', 'expense');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    -- pending = pendente, paid = pago/recebido, cancelled = cancelado
    create type public.transaction_status as enum ('pending', 'paid', 'cancelled');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém `updated_at` sincronizado em updates
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabela: categories
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,                       -- nome do ícone (ex.: "home", "car")
  color       text,                       -- cor em hexadecimal (ex.: "#9BBFB5")
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabela: users (membros da família + whitelist de autorização)
--   * id      : identidade do perfil (independente da conta de autenticação)
--   * auth_id : vínculo com auth.users (nulo até o primeiro login Google)
--   * email   : chave da whitelist (o Admin convida por e-mail)
--   * role    : permissão (admin | member)
--   * status  : invited | active | revoked
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users (id) on delete set null,
  email       text not null,
  full_name   text not null default '',
  role        public.user_role not null default 'member',
  status      public.user_status not null default 'invited',
  avatar_url  text,
  invited_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- E-mail único (case-insensitive) — a whitelist não admite duplicatas.
create unique index if not exists uq_users_email_lower
  on public.users (lower(email));
create index if not exists idx_users_auth_id on public.users (auth_id);

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabela: transactions
--   user_id referencia o PERFIL (public.users.id), não a conta de auth.
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  description  text not null,
  amount       numeric(12, 2) not null check (amount >= 0),
  type         public.transaction_type not null,
  status       public.transaction_status not null default 'pending',
  category_id  uuid references public.categories (id) on delete set null,
  user_id      uuid not null references public.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create index if not exists idx_transactions_date on public.transactions (date desc);
create index if not exists idx_transactions_category on public.transactions (category_id);
create index if not exists idx_transactions_user on public.transactions (user_id);
create index if not exists idx_transactions_type on public.transactions (type);
create index if not exists idx_transactions_status on public.transactions (status);
