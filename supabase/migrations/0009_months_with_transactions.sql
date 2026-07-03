-- =============================================================================
-- FinFam · 0009 — Meses com lançamentos (para o filtro de período)
-- -----------------------------------------------------------------------------
-- Retorna os meses (YYYY-MM) que possuem ao menos um lançamento, para o filtro
-- de período destacar os meses ainda sem extrato. SECURITY INVOKER → respeita o
-- RLS (só enxerga o que o usuário pode ver). Idempotente.
-- =============================================================================

create or replace function public.months_with_transactions()
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select distinct to_char(date, 'YYYY-MM')
    from public.transactions
   order by 1;
$$;

grant execute on function public.months_with_transactions() to authenticated;
