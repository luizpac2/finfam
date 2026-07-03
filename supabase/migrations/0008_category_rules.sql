-- =============================================================================
-- FinFam · 0008 — Regras de categorização por palavra-chave
-- -----------------------------------------------------------------------------
-- Permite ao admin definir regras do tipo:
--   * "categorize": quando a descrição contém a palavra X → categoria Y
--     (ex.: "Luz" → Energia Elétrica).
--   * "ignore": quando a descrição contém a palavra X → ignorar o lançamento
--     na importação.
--
-- As regras são lidas por qualquer membro ativo (para valerem na importação)
-- e gerenciadas apenas por admins (como as categorias). Idempotente.
-- =============================================================================

create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  keyword     text not null,
  action      text not null default 'categorize'
                check (action in ('categorize', 'ignore')),
  category_id uuid references public.categories (id) on delete cascade,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Regra de categorização exige categoria; regra de ignorar não usa categoria.
  constraint category_rules_category_required
    check (action <> 'categorize' or category_id is not null)
);

create index if not exists idx_category_rules_action
  on public.category_rules (action);
create index if not exists idx_category_rules_category
  on public.category_rules (category_id);

drop trigger if exists trg_category_rules_updated_at on public.category_rules;
create trigger trg_category_rules_updated_at
  before update on public.category_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: membros ativos leem; admins gerenciam.
-- -----------------------------------------------------------------------------
alter table public.category_rules enable row level security;

drop policy if exists "category_rules_select_members" on public.category_rules;
create policy "category_rules_select_members"
  on public.category_rules for select
  to authenticated
  using (public.is_active_member());

drop policy if exists "category_rules_admin_insert" on public.category_rules;
create policy "category_rules_admin_insert"
  on public.category_rules for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "category_rules_admin_update" on public.category_rules;
create policy "category_rules_admin_update"
  on public.category_rules for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "category_rules_admin_delete" on public.category_rules;
create policy "category_rules_admin_delete"
  on public.category_rules for delete
  to authenticated
  using (public.is_admin());
