-- =============================================================================
-- FinFam · 0005 — Categorias adicionais (para a categorização automática)
-- -----------------------------------------------------------------------------
-- O motor de categorização (categorizationEngine.ts) referencia estes nomes.
-- Idempotente: não duplica categorias já existentes.
-- =============================================================================

insert into public.categories (name, icon, color)
select v.name, v.icon, v.color
from (values
  ('Veículo',         'fuel',          '#8C888A'),
  ('Compras',         'shopping-bag',  '#9BBFB5'),
  ('Transferências',  'arrow-left-right', '#6D7368')
) as v(name, icon, color)
where not exists (
  select 1 from public.categories c where c.name = v.name
);
