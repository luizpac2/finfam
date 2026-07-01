import { supabase } from '../lib/supabaseClient';
import {
  mapToUser,
  type InviteUserInput,
  type User,
} from '../domain/entities/User';
import type { UserRole } from '../lib/database.types';
import { unwrap } from './serviceError';

const TABLE = 'users';

/**
 * Serviço de acesso à tabela `users` (membros da família + whitelist).
 *
 * A whitelist é a própria tabela `users`: um e-mail só consegue acessar o
 * sistema se já existir aqui um registro (criado pelo Admin) com status
 * diferente de `revoked`. O vínculo com a conta Google é feito por
 * `syncCurrentUser` (RPC `sync_current_user`).
 */
export const userService = {
  /**
   * Resolve o perfil do usuário autenticado, vinculando o convite ao login
   * Google quando necessário. Retorna `null` quando o e-mail não está
   * autorizado (sem convite).
   */
  async syncCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.rpc('sync_current_user');
    if (error) {
      console.error('[service] Falha ao sincronizar o usuário:', error);
      return null;
    }
    return data ? mapToUser(data) : null;
  },

  /** Lista todos os membros/convidados da família. */
  async list(): Promise<User[]> {
    const rows = unwrap(
      await supabase
        .from(TABLE)
        .select('*')
        .order('status', { ascending: true })
        .order('full_name', { ascending: true }),
      'listar os membros'
    );
    return rows.map(mapToUser);
  },

  /**
   * Convida um novo e-mail Google (adiciona à whitelist). Restrito a admins
   * por RLS. O e-mail é normalizado para minúsculas.
   */
  async invite(input: InviteUserInput, invitedBy?: string): Promise<User> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .insert({
          email: input.email.trim().toLowerCase(),
          role: input.role,
          status: 'invited',
          invited_by: invitedBy ?? null,
        })
        .select()
        .single(),
      'enviar o convite'
    );
    return mapToUser(row);
  },

  /** Define a permissão (role) de um membro. Restrito a admins por RLS. */
  async setRole(id: string, role: UserRole): Promise<User> {
    const row = unwrap(
      await supabase.from(TABLE).update({ role }).eq('id', id).select().single(),
      'atualizar a permissão'
    );
    return mapToUser(row);
  },

  /**
   * Revoga o acesso de um membro instantaneamente. O RLS passa a negar toda
   * leitura/escrita para este usuário a partir de agora.
   */
  async revoke(id: string): Promise<User> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .update({ status: 'revoked' })
        .eq('id', id)
        .select()
        .single(),
      'revogar o acesso'
    );
    return mapToUser(row);
  },

  /** Reativa um membro previamente revogado. */
  async reactivate(user: User): Promise<User> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .update({ status: user.authId ? 'active' : 'invited' })
        .eq('id', user.id)
        .select()
        .single(),
      'reativar o acesso'
    );
    return mapToUser(row);
  },

  /** Remove definitivamente um registro (revoga o convite). Restrito a admins. */
  async remove(id: string): Promise<void> {
    unwrap(
      await supabase.from(TABLE).delete().eq('id', id),
      'remover o membro'
    );
  },
};
