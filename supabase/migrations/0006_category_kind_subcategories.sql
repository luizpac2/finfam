-- =============================================================================
-- FinFam · 0006 — Categorias: tipo (receita/despesa) e subcategorias
-- -----------------------------------------------------------------------------
-- Adiciona:
--   * `kind`      → separa categorias entre receita (income) e despesa (expense);
--   * `parent_id` → permite subcategorias (auto-relacionamento).
-- Idempotente.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'category_kind') then
    create type public.category_kind as enum ('income', 'expense');
  end if;
end
$$;

alter table public.categories
  add column if not exists kind public.category_kind not null default 'expense';

alter table public.categories
  add column if not exists parent_id uuid
    references public.categories (id) on delete cascade;

create index if not exists idx_categories_parent
  on public.categories (parent_id);

-- Classifica como receita as categorias já existentes que fazem sentido.
update public.categories
   set kind = 'income'
 where name in ('Salário', 'Investimentos')
   and kind = 'expense';
