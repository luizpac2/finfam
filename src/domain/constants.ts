/**
 * Constantes e enumerações do domínio.
 *
 * Os valores correspondem exatamente aos tipos ENUM definidos no banco
 * (ver `supabase/migrations`). Manter uma fonte única evita divergência
 * entre frontend e banco de dados.
 */
import type {
  CategoryKind,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '../lib/database.types';

export const UserRoleValue = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const satisfies Record<string, UserRole>;

export const UserStatusValue = {
  INVITED: 'invited',
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const satisfies Record<string, UserStatus>;

export const TransactionTypeValue = {
  INCOME: 'income', // receita
  EXPENSE: 'expense', // despesa
} as const satisfies Record<string, TransactionType>;

export const TransactionStatusValue = {
  PENDING: 'pending', // pendente
  PAID: 'paid', // pago / recebido
  CANCELLED: 'cancelled', // cancelado
} as const satisfies Record<string, TransactionStatus>;

/** Rótulos em PT-BR para exibição na interface. */
export const TransactionTypeLabel: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
};

export const TransactionStatusLabel: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

/** Rótulos dos tipos de categoria (receita / despesa / cartão de crédito). */
export const CategoryKindLabel: Record<CategoryKind, string> = {
  income: 'Receita',
  expense: 'Despesa',
  credit_card: 'Cartão de Crédito',
};

export const UserRoleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  member: 'Membro',
};

export const UserStatusLabel: Record<UserStatus, string> = {
  invited: 'Convidado',
  active: 'Ativo',
  revoked: 'Revogado',
};
