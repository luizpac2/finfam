-- =============================================================================
-- FinFam · 0010 — Regras por VALOR do lançamento
-- -----------------------------------------------------------------------------
-- Amplia `category_rules` para casar também pelo VALOR:
--   * por valor:            valor = X            → categoria / ignorar
--   * por palavra + valor:  descrição contém P e valor = X → categoria / ignorar
--
-- Assim, `keyword` deixa de ser obrigatória: uma regra precisa ter palavra
-- E/OU valor. Idempotente.
-- =============================================================================

alter table public.category_rules
  add column if not exists amount numeric(12, 2);

-- keyword passa a ser opcional (regra pode ser só por valor).
alter table public.category_rules
  alter column keyword drop not null;

-- Pelo menos uma condição: palavra ou valor.
alter table public.category_rules
  drop constraint if exists category_rules_has_condition;
alter table public.category_rules
  add constraint category_rules_has_condition
    check (
      (keyword is not null and length(btrim(keyword)) > 0)
      or amount is not null
    );

-- Valor, quando informado, não pode ser negativo (comparamos pelo valor absoluto).
alter table public.category_rules
  drop constraint if exists category_rules_amount_non_negative;
alter table public.category_rules
  add constraint category_rules_amount_non_negative
    check (amount is null or amount >= 0);

create index if not exists idx_category_rules_amount
  on public.category_rules (amount);
