-- =============================================================================
-- FinFam · 0003 — Row Level Security (RLS)
-- -----------------------------------------------------------------------------
-- Princípios:
--   * Somente membros ATIVOS (is_active_member) enxergam qualquer dado. Assim,
--     revogar alguém corta o acesso INSTANTANEAMENTE — o RLS passa a negar
--     toda leitura/escrita, mesmo com a sessão Google ainda válida.
--   * Transações: o autor (user_id = current_profile_id) ou um admin editam.
--   * Categorias e gestão de membros: apenas admins.
--   * O vínculo conta↔convite é feito por funções SECURITY DEFINER (0002),
--     que ignoram o RLS — por isso não há policy de INSERT para o fluxo de login.
-- =============================================================================

alter table public.categories   enable row level security;
alter table public.users        enable row level security;
alter table public.transactions enable row level security;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
drop policy if exists "categories_select_members" on public.categories;
create policy "categories_select_members"
  on public.categories for select
  to authenticated
  using (public.is_active_member());

drop policy if exists "categories_admin_insert" on public.categories;
create policy "categories_admin_insert"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "categories_admin_update" on public.categories;
create policy "categories_admin_update"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "categories_admin_delete" on public.categories;
create policy "categories_admin_delete"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- users (perfis + whitelist) — leitura para membros, gestão para admins
-- -----------------------------------------------------------------------------
drop policy if exists "users_select_members" on public.users;
create policy "users_select_members"
  on public.users for select
  to authenticated
  using (public.is_active_member());

drop policy if exists "users_admin_insert" on public.users;
create policy "users_admin_insert"
  on public.users for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update"
  on public.users for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "users_admin_delete" on public.users;
create policy "users_admin_delete"
  on public.users for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- transactions
-- -----------------------------------------------------------------------------
drop policy if exists "transactions_select_members" on public.transactions;
create policy "transactions_select_members"
  on public.transactions for select
  to authenticated
  using (public.is_active_member());

-- Cada membro só insere transações em seu próprio nome.
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (
    public.is_active_member() and user_id = public.current_profile_id()
  );

-- Autor ou admin podem editar.
drop policy if exists "transactions_update_owner_or_admin" on public.transactions;
create policy "transactions_update_owner_or_admin"
  on public.transactions for update
  to authenticated
  using (user_id = public.current_profile_id() or public.is_admin())
  with check (user_id = public.current_profile_id() or public.is_admin());

-- Autor ou admin podem excluir.
drop policy if exists "transactions_delete_owner_or_admin" on public.transactions;
create policy "transactions_delete_owner_or_admin"
  on public.transactions for delete
  to authenticated
  using (user_id = public.current_profile_id() or public.is_admin());
