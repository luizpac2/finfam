-- =============================================================================
-- FinFam · 0018 — quando o cancelamento do cartão foi registrado (dia e hora)
-- -----------------------------------------------------------------------------
-- `categories.closed_at` é uma DATE (a data em que o cartão foi cancelado — o
-- admin pode editá-la, e ela define a partir de quando não se espera mais fatura).
--
-- Esta coluna guarda outra coisa: o MOMENTO EXATO (dia e hora) em que a ação de
-- cancelar foi feita no sistema — um registro de auditoria que não muda se
-- depois alguém corrigir a data de cancelamento. Volta a NULL ao reativar.
-- =============================================================================

alter table public.categories
  add column if not exists closed_registered_at timestamptz;

comment on column public.categories.closed_registered_at is
  'Momento (dia e hora) em que o cancelamento do cartão foi registrado no sistema. Diferente de closed_at, que é a data de cancelamento (editável).';

-- Faz o PostgREST recarregar o cache de schema para enxergar a coluna na hora.
notify pgrst, 'reload schema';
