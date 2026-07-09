-- =============================================================================
-- FinFam · 0016 — Forma de pagamento do lançamento
-- -----------------------------------------------------------------------------
-- `transactions.payment_method` — como o lançamento foi movimentado:
--   credit_card | debit_card | pix | ted | cash | boleto | other  (ou null).
-- Quando `credit_card`, o cartão específico continua em `card_id`.
-- Texto com CHECK (flexível, sem enum). Idempotente.
-- =============================================================================

alter table public.transactions
  add column if not exists payment_method text;

alter table public.transactions
  drop constraint if exists transactions_payment_method_check;
alter table public.transactions
  add constraint transactions_payment_method_check
    check (
      payment_method is null
      or payment_method in (
        'credit_card', 'debit_card', 'pix', 'ted', 'cash', 'boleto', 'other'
      )
    );
