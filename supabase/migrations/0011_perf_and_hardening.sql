-- =============================================================================
-- FinFam · 0011 — Performance e endurecimento (segurança)
-- -----------------------------------------------------------------------------
-- 1. Índice de busca textual (trigram) para a busca global por descrição, que
--    usa ILIKE '%termo%' (curinga à esquerda não usa índice B-tree comum).
-- 2. Índice de intervalo de datas (o filtro mais frequente).
-- 3. Define search_path explícito em set_updated_at (consistência/segurança).
-- Idempotente.
-- =============================================================================

-- 1) Busca por descrição (ILIKE) rápida com pg_trgm.
create extension if not exists pg_trgm;

create index if not exists idx_transactions_description_trgm
  on public.transactions using gin (description gin_trgm_ops);

-- 2) Filtro por intervalo de datas já ordenado (Dashboard, Transações).
--    (idx_transactions_date já existe; mantido por clareza/idempotência.)
create index if not exists idx_transactions_date
  on public.transactions (date desc);

-- 3) Endurecimento: trigger util com search_path fixo.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
