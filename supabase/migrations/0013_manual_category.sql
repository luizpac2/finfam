-- =============================================================================
-- FinFam · 0013 — categoria definida manualmente (protege edições na mão)
-- -----------------------------------------------------------------------------
-- Problema: aplicar as regras ao histórico (página Regras) recategorizava
-- QUALQUER lançamento que casasse com a regra, sobrescrevendo ajustes feitos à
-- mão na página de Transações. Como não havia como distinguir uma categoria
-- definida manualmente de uma automática, as edições eram perdidas.
--
-- Solução: uma flag `manual_category`. Fica `true` quando o usuário define a
-- categoria à mão (editor ou edição em massa). A aplicação de regras ao
-- histórico e a categorização automática PASSAM A IGNORAR estes lançamentos.
--
-- Observação: lançamentos já existentes ficam com `false` (não há como saber
-- retroativamente quais foram manuais). A partir de agora, toda edição manual
-- marca a flag e fica protegida.
-- =============================================================================

alter table public.transactions
  add column if not exists manual_category boolean not null default false;

comment on column public.transactions.manual_category is
  'true quando a categoria foi definida manualmente pelo usuário; a aplicação de regras ao histórico e a categorização automática não sobrescrevem estes lançamentos.';

-- Força o PostgREST a recarregar o cache de schema para enxergar a coluna nova
-- imediatamente (senão o app pode continuar em "modo seguro" por alguns minutos).
notify pgrst, 'reload schema';
