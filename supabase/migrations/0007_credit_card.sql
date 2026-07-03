-- =============================================================================
-- FinFam · 0007 — Cartão de Crédito
-- -----------------------------------------------------------------------------
-- Adiciona:
--   * valor 'credit_card' ao enum category_kind → um novo TIPO de categoria,
--     ao lado de receita/despesa. Cada cartão do usuário é uma categoria desse
--     tipo (ex.: "Nubank", "Itaú").
--   * coluna transactions.card_id → em qual cartão a compra foi lançada
--     (preenchido ao importar um extrato de cartão). Referencia a categoria do
--     cartão. Nulo para lançamentos comuns.
--
-- Regra de negócio (aplicada no app):
--   - Lançamentos cuja CATEGORIA é do tipo 'credit_card' (o pagamento da fatura
--     no extrato do banco) NÃO contam em Despesas nem no saldo.
--   - As compras do extrato do cartão entram como Despesas normais.
--
-- Idempotente.
-- =============================================================================

alter type public.category_kind add value if not exists 'credit_card';

alter table public.transactions
  add column if not exists card_id uuid
    references public.categories (id) on delete set null;

create index if not exists idx_transactions_card
  on public.transactions (card_id);
