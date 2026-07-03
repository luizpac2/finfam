import { supabase } from '../lib/supabaseClient';
import {
  mapToTransaction,
  mapToTransactionRow,
  type Transaction,
  type TransactionInput,
} from '../domain/entities/Transaction';
import type {
  TransactionRowWithCategory,
  TransactionStatus,
  TransactionType,
} from '../lib/database.types';
import { unwrap } from './serviceError';

const TABLE = 'transactions';

// Seleciona a transação já com a categoria relacionada (join via FK).
const SELECT_WITH_CATEGORY =
  '*, categories ( id, name, icon, color, created_at, updated_at )';

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  categoryId?: string;
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
}

export interface FinancialSummary {
  income: number;
  expense: number;
  balance: number;
}

export const transactionService = {
  /** Lista transações com filtros opcionais, ordenadas pela data (desc). */
  async list(filters: TransactionFilters = {}): Promise<Transaction[]> {
    let query = supabase
      .from(TABLE)
      .select(SELECT_WITH_CATEGORY)
      .order('date', { ascending: false });

    if (filters.type) query = query.eq('type', filters.type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);

    const rows = unwrap(await query, 'listar as transações');
    return (rows as unknown as TransactionRowWithCategory[]).map(
      mapToTransaction
    );
  },

  /** Busca uma transação por id (com categoria). */
  async getById(id: string): Promise<Transaction> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .select(SELECT_WITH_CATEGORY)
        .eq('id', id)
        .single(),
      'carregar a transação'
    );
    return mapToTransaction(row as unknown as TransactionRowWithCategory);
  },

  /** Cria uma transação. O `userId` deve ser o id do perfil autenticado. */
  async create(input: TransactionInput): Promise<Transaction> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .insert({
          description: input.description,
          amount: Math.abs(Number(input.amount)),
          type: input.type,
          user_id: input.userId,
          date: input.date,
          status: input.status,
          category_id: input.categoryId ?? null,
        })
        .select(SELECT_WITH_CATEGORY)
        .single(),
      'criar a transação'
    );
    return mapToTransaction(row as unknown as TransactionRowWithCategory);
  },

  /** Atualiza uma transação existente (autor ou admin, via RLS). */
  async update(
    id: string,
    input: Partial<TransactionInput>
  ): Promise<Transaction> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .update(mapToTransactionRow(input))
        .eq('id', id)
        .select(SELECT_WITH_CATEGORY)
        .single(),
      'atualizar a transação'
    );
    return mapToTransaction(row as unknown as TransactionRowWithCategory);
  },

  /**
   * Insere várias transações de uma vez (usado na importação de extratos).
   * Cada item deve trazer `userId` = id do perfil autenticado (exigido pelo RLS).
   * @returns Quantidade de transações criadas.
   */
  async createMany(inputs: TransactionInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const rows = inputs.map((input) => ({
      description: input.description,
      amount: Math.abs(Number(input.amount)),
      type: input.type,
      user_id: input.userId,
      date: input.date,
      status: input.status ?? 'pending',
      category_id: input.categoryId ?? null,
    }));
    const data = unwrap(
      await supabase.from(TABLE).insert(rows).select('id'),
      'importar as transações'
    );
    return data.length;
  },

  /** Remove uma transação (autor ou admin, via RLS). */
  async remove(id: string): Promise<void> {
    unwrap(
      await supabase.from(TABLE).delete().eq('id', id),
      'excluir a transação'
    );
  },

  /**
   * Atribui uma categoria (ou nenhuma, se `null`) a várias transações de uma
   * vez. Usado na edição em massa da página de Transações.
   */
  async setCategoryMany(ids: string[], categoryId: string | null): Promise<void> {
    if (ids.length === 0) return;
    unwrap(
      await supabase
        .from(TABLE)
        .update({ category_id: categoryId })
        .in('id', ids),
      'atualizar as categorias'
    );
  },

  /** Remove várias transações de uma vez (edição em massa). */
  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    unwrap(
      await supabase.from(TABLE).delete().in('id', ids),
      'excluir as transações'
    );
  },

  /**
   * Calcula um resumo financeiro (receitas, despesas e saldo) no período.
   * Ignora transações canceladas.
   */
  async summary(period: TransactionFilters = {}): Promise<FinancialSummary> {
    const transactions = await this.list(period);
    const totals = transactions.reduce(
      (acc, tx) => {
        if (tx.status === 'cancelled') return acc;
        if (tx.type === 'income') acc.income += tx.amount;
        else if (tx.type === 'expense') acc.expense += tx.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );

    return {
      income: totals.income,
      expense: totals.expense,
      balance: totals.income - totals.expense,
    };
  },
};
