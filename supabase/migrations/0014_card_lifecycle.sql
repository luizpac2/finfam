-- =============================================================================
-- FinFam · 0014 — Ciclo de vida do cartão + cobertura de faturas por mês
-- -----------------------------------------------------------------------------
-- 1. `categories.closed_at` — para categorias do tipo `credit_card`: data em que
--    o cartão foi CANCELADO. Null = cartão vigente. Assim dá para declarar quais
--    cartões estão em uso e desde quando deixaram de estar.
-- 2. RPC `card_months()` — meses (YYYY-MM) que já têm lançamentos por cartão,
--    para montar a matriz "cartão × mês: fatura enviada?". SECURITY INVOKER
--    (respeita o RLS). Idempotente.
-- =============================================================================

alter table public.categories
  add column if not exists closed_at date;

create or replace function public.card_months()
returns table (card_id uuid, ym text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct t.card_id, to_char(t.date, 'YYYY-MM')
    from public.transactions t
   where t.card_id is not null;
$$;

grant execute on function public.card_months() to authenticated;
