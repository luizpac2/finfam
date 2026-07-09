-- =============================================================================
-- FinFam · 0017 — Forma de pagamento na regra de categorização
-- -----------------------------------------------------------------------------
-- `category_rules.payment_method` — quando a regra casa, além (ou em vez) de
-- definir a categoria, também classifica a forma de movimentação do lançamento:
--   credit_card | debit_card | pix | ted | cash | boleto | other  (ou null).
-- Mesmos valores de `transactions.payment_method` (0016). Idempotente.
-- =============================================================================

alter table public.category_rules
  add column if not exists payment_method text;

alter table public.category_rules
  drop constraint if exists category_rules_payment_method_check;
alter table public.category_rules
  add constraint category_rules_payment_method_check
    check (
      payment_method is null
      or payment_method in (
        'credit_card', 'debit_card', 'pix', 'ted', 'cash', 'boleto', 'other'
      )
    );
