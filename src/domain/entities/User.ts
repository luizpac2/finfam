import type {
  UserRole,
  UserStatus,
  UserRow,
  UserUpdate,
} from '../../lib/database.types';

export interface User {
  id: string;
  authId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface InviteUserInput {
  email: string;
  role: UserRole;
}

export interface UpdateUserInput {
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  avatarUrl?: string | null;
}

/** Mapeia uma linha da tabela `users` para a entidade de domínio. */
export const mapToUser = (row: UserRow): User => ({
  id: row.id,
  authId: row.auth_id,
  email: row.email,
  fullName: row.full_name ?? '',
  role: row.role,
  status: row.status,
  avatarUrl: row.avatar_url,
  invitedBy: row.invited_by,
  createdAt: row.created_at,
});

/** Converte a entidade de domínio (parcial) para o formato da tabela. */
export const mapToUserRow = (input: UpdateUserInput): UserUpdate => {
  const row: UserUpdate = {};
  if (input.fullName !== undefined) row.full_name = input.fullName;
  if (input.role !== undefined) row.role = input.role;
  if (input.status !== undefined) row.status = input.status;
  if (input.avatarUrl !== undefined) row.avatar_url = input.avatarUrl;
  return row;
};

export const isAdmin = (user: User | null): boolean =>
  user?.role === 'admin' && user?.status === 'active';

export const isActive = (user: User | null): boolean =>
  user?.status === 'active';
