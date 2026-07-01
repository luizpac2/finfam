-- =============================================================================
-- FinFam · 0002 — Funções de autenticação, whitelist e helpers de RLS
-- -----------------------------------------------------------------------------
-- Fluxo de whitelist (login EXCLUSIVO via Google):
--   1. Admin convida um e-mail        → linha em public.users (status 'invited').
--   2. Usuário faz login com o Google → cria-se a conta em auth.users.
--   3. O vínculo (auth_id) + ativação acontece em `handle_new_user` (gatilho)
--      e/ou em `sync_current_user` (RPC chamada pelo frontend após o login),
--      cobrindo os dois casos: convite-antes-do-login e login-antes-do-convite.
--   4. Sem convite válido → nenhum perfil ativo → acesso negado pelo RLS.
--
-- Bootstrap: o PRIMEIRO usuário a entrar (quando a tabela está vazia) vira
-- 'admin' ativo automaticamente, resolvendo o problema do "primeiro acesso".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de RLS (SECURITY DEFINER para ler public.users sem recursão de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.users
   where auth_id = auth.uid() and status = 'active'
   limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users
   where auth_id = auth.uid() and status = 'active'
   limit 1;
$$;

create or replace function public.is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
     where auth_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- -----------------------------------------------------------------------------
-- Gatilho: ao criar a conta Google em auth.users
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total       integer;
  invited_row public.users;
  meta_name   text := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );
  meta_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  -- Bootstrap: primeiríssimo usuário vira admin ativo.
  select count(*) into total from public.users;
  if total = 0 then
    insert into public.users (auth_id, email, full_name, role, status, avatar_url)
    values (new.id, new.email, meta_name, 'admin', 'active', meta_avatar);
    return new;
  end if;

  -- Convite existente (não revogado)? Vincula e ativa.
  select * into invited_row
    from public.users
   where lower(email) = lower(new.email)
     and status <> 'revoked'
   order by created_at
   limit 1;

  if found then
    update public.users
       set auth_id    = new.id,
           status     = 'active',
           full_name  = case when full_name = '' then meta_name else full_name end,
           avatar_url = coalesce(avatar_url, meta_avatar)
     where id = invited_row.id;
  end if;

  -- Sem convite: nenhum perfil é criado → usuário fica sem autorização.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RPC: resolve o perfil do usuário autenticado (e faz o vínculo tardio).
-- Chamada pelo frontend após o login. Retorna o perfil (ativo OU revogado,
-- para a UI diferenciar) ou NULL quando o e-mail não está autorizado.
-- -----------------------------------------------------------------------------
create or replace function public.sync_current_user()
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  prof   public.users;
begin
  if uid is null then
    return null;
  end if;

  -- Já vinculado e ativo.
  select * into prof from public.users
   where auth_id = uid and status = 'active' limit 1;
  if found then
    return prof;
  end if;

  -- Bootstrap (tabela vazia): torna-se admin ativo.
  if not exists (select 1 from public.users) then
    insert into public.users (auth_id, email, full_name, role, status)
    values (uid, uemail, '', 'admin', 'active')
    returning * into prof;
    return prof;
  end if;

  -- Vínculo tardio: convite por e-mail (não revogado, ainda sem auth_id).
  select * into prof from public.users
   where lower(email) = lower(uemail)
     and status <> 'revoked'
   order by created_at limit 1;
  if found then
    update public.users
       set auth_id = uid, status = 'active'
     where id = prof.id
     returning * into prof;
    return prof;
  end if;

  -- Pode existir uma linha revogada com este e-mail; devolvemos para a UI
  -- mostrar "acesso revogado". Caso contrário, NULL (sem convite).
  select * into prof from public.users
   where lower(email) = lower(uemail) limit 1;
  return prof;
end;
$$;

-- Permite que usuários autenticados chamem a RPC.
grant execute on function public.sync_current_user() to authenticated;
