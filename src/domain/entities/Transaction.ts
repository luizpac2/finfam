import type {
  TransactionStatus,
  TransactionType,
  TransactionRowWithCategory,
  TransactionUpdate,
} from '../../lib/database.types';
import { mapToCategory, type Category } from './Category';

export interface Transaction {
  id: string;
  date: string; // ISO (YYYY-MM-DD)
  description: string;
  amount: number; // sempre positivo; o sinal vem de `type`
  type: TransactionType;
  status: TransactionStatus;
  categoryId: string | null;
  userId: string;
  category: Category | null; // categoria expandida (join opcional)
  createdAt: string;
}

export interface TransactionInput {
  date?: string;
  description: string;
  amount: number;
  type: TransactionType;
  status?: TransactionStatus;
  categoryId?: string | null;
  userId: string;
}

/** Mapeia uma linha de `transactions` (com categoria embutida) para o domínio. */
export const mapToTransaction = (
  row: TransactionRowWithCategory
): Transaction => ({
  id: row.id,
  date: row.date,
  description: row.description,
  amount: Number(row.amount),
  type: row.type,
  status: row.status,
  categoryId: row.category_id,
  userId: row.user_id,
  category: row.categories ? mapToCategory(row.categories) : null,
  createdAt: row.created_at,
});

/** Converte a entidade de domínio (parcial) para o formato da tabela. */
export const mapToTransactionRow = (
  input: Partial<TransactionInput>
): TransactionUpdate => {
  const row: TransactionUpdate = {};
  if (input.date !== undefined) row.date = input.date;
  if (input.description !== undefined) row.description = input.description;
  if (input.amount !== undefined) row.amount = Math.abs(Number(input.amount));
  if (input.type !== undefined) row.type = input.type;
  if (input.status !== undefined) row.status = input.status;
  if (input.categoryId !== undefined) row.category_id = input.categoryId;
  if (input.userId !== undefined) row.user_id = input.userId;
  return row;
};
