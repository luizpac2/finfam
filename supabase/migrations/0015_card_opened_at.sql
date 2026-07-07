-- =============================================================================
-- FinFam · 0015 — "Vigente desde" do cartão
-- -----------------------------------------------------------------------------
-- `categories.opened_at` — para cartões (`credit_card`): a partir de quando o
-- cartão passou a valer (declaração do usuário). Define o INÍCIO do período em
-- que se espera fatura. Null = usa como referência o mês mais antigo com dados.
-- Assim, um cartão vigente SEM nenhuma fatura importada aparece como "faltando"
-- (antes ele era ignorado por não ter histórico). Idempotente.
-- =============================================================================

alter table public.categories
  add column if not exists opened_at date;
