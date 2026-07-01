-- =============================================================================
-- FinFam · 0004 — Categorias iniciais (seed)
-- -----------------------------------------------------------------------------
-- Popula categorias padrão usando a paleta da marca. Idempotente: não duplica
-- caso já existam categorias com o mesmo nome.
-- =============================================================================

insert into public.categories (name, icon, color)
select v.name, v.icon, v.color
from (values
  ('Salário',        'wallet',        '#9BBFB5'),
  ('Moradia',        'home',          '#6D7368'),
  ('Alimentação',    'shopping-cart', '#9BBFB5'),
  ('Transporte',     'car',           '#8C888A'),
  ('Saúde',          'heart-pulse',   '#9BBFB5'),
  ('Educação',       'graduation-cap','#6D7368'),
  ('Lazer',          'gamepad-2',     '#F1F2CE'),
  ('Contas/Serviços','receipt',       '#8C888A'),
  ('Investimentos',  'trending-up',   '#9BBFB5'),
  ('Outros',         'circle-ellipsis','#8C888A')
) as v(name, icon, color)
where not exists (
  select 1 from public.categories c where c.name = v.name
);
