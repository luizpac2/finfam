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
  cardId: string | null; // cartão de crédito da compra (importação de fatura)
  userId: string;
  /** true quando a categoria foi definida manualmente (regras não sobrescrevem). */
  manualCategory: boolean;
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
  cardId?: string | null;
  userId: string;
  manualCategory?: boolean;
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
  cardId: row.card_id,
  userId: row.user_id,
  // Tolerante à migração 0013 ainda não aplicada (coluna ausente → false).
  manualCategory: Boolean(row.manual_category),
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
  if (input.cardId !== undefined) row.card_id = input.cardId;
  if (input.userId !== undefined) row.user_id = input.userId;
  if (input.manualCategory !== undefined)
    row.manual_category = input.manualCategory;
  return row;
};
