-- =============================================================================
-- FinFam · 0012 — Resumo financeiro agregado no banco (RPC)
-- -----------------------------------------------------------------------------
-- Substitui o cálculo do "saldo acumulado" no cliente (que baixava TODO o
-- histórico) por uma agregação em SQL. Soma receitas e despesas no período,
-- EXCLUINDO pagamentos de fatura (categorias tipo 'credit_card'), pela mesma
-- regra usada no app.
--
-- SECURITY INVOKER → respeita o RLS (só agrega o que o usuário pode ver).
-- Idempotente.
-- =============================================================================

create or replace function public.financial_summary(
  p_from date default null,
  p_to   date default null
)
returns table (income numeric, expense numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric  as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric as expense
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where (p_from is null or t.date >= p_from)
    and (p_to   is null or t.date <= p_to)
    and c.kind is distinct from 'credit_card';
$$;

grant execute on function public.financial_summary(date, date) to authenticated;
