-- =============================================================================
-- FinFam · RESET
-- -----------------------------------------------------------------------------
-- Remove TODOS os objetos criados pelas migrations (tabelas, funções, gatilhos,
-- tipos e policies), permitindo recriar o schema do zero.
--
-- ATENÇÃO:
--   * Isto APAGA os dados de `categories`, `users` e `transactions`.
--   * NÃO remove contas de `auth.users`. Para um reset 100% limpo do fluxo de
--     whitelist, apague também os usuários em Authentication → Users (ou via a
--     seção opcional no final deste arquivo).
--
-- Como usar:
--   1. SQL Editor do Supabase → cole e execute este arquivo.
--   2. Em seguida, rode novamente, na ordem:
--        0001_initial_schema.sql
--        0002_auth_functions.sql
--        0003_rls_policies.sql
--        0004_seed_categories.sql   (opcional)
-- =============================================================================

begin;

-- 1) Gatilho em auth.users (depende de handle_new_user) -----------------------
drop trigger if exists on_auth_user_created on auth.users;

-- 2) Tabelas (CASCADE remove policies, gatilhos, índices e FKs dependentes) ----
drop table if exists public.transactions cascade;
drop table if exists public.users cascade;
drop table if exists public.categories cascade;

-- 3) Funções (CASCADE cobre quaisquer dependências remanescentes) -------------
drop function if exists public.sync_current_user() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_profile_id() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.is_active_member() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.set_updated_at() cascade;
-- Legado (versões anteriores do schema), se existirem:
drop function if exists public.guard_user_role_change() cascade;

-- 4) Tipos ENUM ----------------------------------------------------------------
drop type if exists public.transaction_status cascade;
drop type if exists public.transaction_type cascade;
drop type if exists public.user_status cascade;
drop type if exists public.user_role cascade;

commit;

-- =============================================================================
-- OPCIONAL — apagar também as contas de autenticação (Google) já criadas.
-- Descomente para zerar completamente o ciclo de convite/login.
-- Útil quando você quer que o "primeiro login" volte a virar admin (bootstrap).
-- =============================================================================
-- delete from auth.users;
