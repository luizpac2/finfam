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
import { ServiceError, unwrap } from './serviceError';

const TABLE = 'transactions';

// Seleciona a transação já com a categoria relacionada (join via FK).
// Inclui `kind` para permitir excluir pagamentos de fatura (cartão) dos totais.
// IMPORTANTE: `transactions` tem DUAS FKs para `categories` (category_id e
// card_id); por isso desambiguamos o embed com `!category_id`, senão o PostgREST
// rejeita o join por ambiguidade.
const SELECT_WITH_CATEGORY =
  '*, categories!category_id ( id, name, icon, color, kind, parent_id, created_at, updated_at )';

/**
 * Detecta o erro do PostgREST quando a coluna `manual_category` ainda não
 * existe (migração 0013 não aplicada). Permite tratar a escrita/leitura de
 * forma tolerante e não perder edições durante o intervalo do deploy.
 */
const isMissingManualColumn = (
  error: { message?: string; details?: string; hint?: string } | null
): boolean =>
  !!error &&
  /manual_category/i.test(
    `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  );

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

/** Versão enxuta de transação (sem join de categoria), para operações em lote. */
export interface TransactionLite {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  /** true quando a categoria foi definida manualmente (regras não sobrescrevem). */
  manualCategory: boolean;
}

/** Converte um termo numérico ("12,50", "12.50", "1234") em número, ou null. */
const parseSearchAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.abs(n) : null;
};

/** Monta o filtro `or` do PostgREST para busca por descrição e/ou valor. */
const buildSearchOr = (term: string): string | null => {
  const t = term.trim();
  const safe = t.replace(/[,().*%]/g, ' ').trim();
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(t);
  const num = hasLetters ? null : parseSearchAmount(t);
  const or: string[] = [];
  if (safe) or.push(`description.ilike.*${safe}*`);
  if (num !== null) or.push(`amount.eq.${num}`);
  return or.length ? or.join(',') : null;
};

/** Filtros da listagem paginada de lançamentos (ex.: página de categoria). */
export interface PagedFilters {
  categoryId?: string;
  /** Vários ids (ex.: categoria + subcategorias). Tem prioridade sobre categoryId. */
  categoryIds?: string[];
  type?: TransactionType;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  search?: string;
}

export interface PagedResult {
  rows: Transaction[];
  total: number;
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

  /**
   * Lista enxuta (sem join de categoria e só com as colunas necessárias),
   * para operações em lote sobre o histórico (aplicar regras, recategorizar).
   * Reduz payload e custo do PostgREST vs. `list` com embed.
   */
  async listLite(filters: TransactionFilters = {}): Promise<TransactionLite[]> {
    const BASE = 'id, date, description, amount, type, category_id';
    const build = (select: string) => {
      let query = supabase
        .from(TABLE)
        .select(select)
        .order('date', { ascending: false });
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.from) query = query.gte('date', filters.from);
      if (filters.to) query = query.lte('date', filters.to);
      return query;
    };

    // Tenta trazer a flag manual; se a migração 0013 ainda não rodou, refaz sem.
    let res = await build(`${BASE}, manual_category`);
    if (res.error && isMissingManualColumn(res.error)) res = await build(BASE);

    const rows = unwrap(res, 'listar as transações');
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      date: r.date as string,
      description: r.description as string,
      amount: Number(r.amount),
      type: r.type as TransactionType,
      categoryId: (r.category_id as string | null) ?? null,
      manualCategory: Boolean(r.manual_category),
    }));
  },

  /**
   * Busca inteligente de lançamentos por descrição e/ou valor.
   * Se o termo for numérico, também casa pelo valor exato.
   */
  async search(term: string): Promise<Transaction[]> {
    const t = term.trim();
    if (t.length < 2) return [];

    // Sanitiza caracteres que quebram a sintaxe do filtro `or` do PostgREST.
    const safe = t.replace(/[,().*%]/g, ' ').trim();
    // Valor: só quando o termo não tem letras (senão é busca por descrição).
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(t);
    const num = hasLetters ? null : parseSearchAmount(t);

    const filters: string[] = [];
    if (safe) filters.push(`description.ilike.*${safe}*`);
    if (num !== null) filters.push(`amount.eq.${num}`);
    if (filters.length === 0) return [];

    const rows = unwrap(
      await supabase
        .from(TABLE)
        .select(SELECT_WITH_CATEGORY)
        .or(filters.join(','))
        .order('date', { ascending: false })
        .limit(25),
      'buscar os lançamentos'
    );
    return (rows as unknown as TransactionRowWithCategory[]).map(
      mapToTransaction
    );
  },

  /**
   * Lista paginada (server-side) com contagem total. Um acesso ao banco por
   * página, trazendo apenas `pageSize` linhas — bom para históricos grandes.
   */
  async listPaged(
    filters: PagedFilters,
    page: number,
    pageSize: number
  ): Promise<PagedResult> {
    let query = supabase
      .from(TABLE)
      .select(SELECT_WITH_CATEGORY, { count: 'exact' })
      .order('date', { ascending: false });

    if (filters.categoryIds && filters.categoryIds.length > 0)
      query = query.in('category_id', filters.categoryIds);
    else if (filters.categoryId)
      query = query.eq('category_id', filters.categoryId);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);
    if (filters.search) {
      const or = buildSearchOr(filters.search);
      if (or) query = query.or(or);
    }

    const start = (page - 1) * pageSize;
    query = query.range(start, start + pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('[service] Falha ao paginar transações:', error);
      throw new ServiceError('Não foi possível listar as transações.', error);
    }
    return {
      rows: (data as unknown as TransactionRowWithCategory[]).map(
        mapToTransaction
      ),
      total: count ?? 0,
    };
  },

  /**
   * Totais (receita/despesa) do conjunto filtrado — consulta enxuta (só
   * `amount, type`, sem join), somada no cliente. Usada nos totais da página.
   */
  async filteredTotals(
    filters: PagedFilters
  ): Promise<{ income: number; expense: number }> {
    let query = supabase.from(TABLE).select('amount, type');
    if (filters.categoryIds && filters.categoryIds.length > 0)
      query = query.in('category_id', filters.categoryIds);
    else if (filters.categoryId)
      query = query.eq('category_id', filters.categoryId);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);
    if (filters.search) {
      const or = buildSearchOr(filters.search);
      if (or) query = query.or(or);
    }

    const rows = unwrap(await query, 'somar as transações');
    return (rows as unknown as Array<{ amount: number; type: TransactionType }>).reduce(
      (acc, r) => {
        if (r.type === 'income') acc.income += Number(r.amount);
        else acc.expense += Number(r.amount);
        return acc;
      },
      { income: 0, expense: 0 }
    );
  },

  /** Retorna o conjunto de meses ("YYYY-MM") que possuem lançamentos. */
  async monthsWithData(): Promise<Set<string>> {
    const { data, error } = await supabase.rpc('months_with_transactions');
    if (error) {
      console.error('[service] Falha ao carregar meses com lançamentos:', error);
      return new Set();
    }
    return new Set((data ?? []) as string[]);
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
    const base = {
      description: input.description,
      amount: Math.abs(Number(input.amount)),
      type: input.type,
      user_id: input.userId,
      date: input.date,
      status: input.status,
      category_id: input.categoryId ?? null,
      card_id: input.cardId ?? null,
    };
    const withManual =
      input.manualCategory !== undefined
        ? { ...base, manual_category: input.manualCategory }
        : base;
    const runInsert = (payload: typeof base | typeof withManual) =>
      supabase.from(TABLE).insert(payload).select(SELECT_WITH_CATEGORY).single();

    let res = await runInsert(withManual);
    if (res.error && withManual !== base && isMissingManualColumn(res.error))
      res = await runInsert(base);

    const row = unwrap(res, 'criar a transação');
    return mapToTransaction(row as unknown as TransactionRowWithCategory);
  },

  /** Atualiza uma transação existente (autor ou admin, via RLS). */
  async update(
    id: string,
    input: Partial<TransactionInput>
  ): Promise<Transaction> {
    const rowInput = mapToTransactionRow(input);
    const runUpdate = (payload: typeof rowInput) =>
      supabase
        .from(TABLE)
        .update(payload)
        .eq('id', id)
        .select(SELECT_WITH_CATEGORY)
        .single();

    let res = await runUpdate(rowInput);
    if (
      res.error &&
      'manual_category' in rowInput &&
      isMissingManualColumn(res.error)
    ) {
      const fallback = { ...rowInput };
      delete fallback.manual_category;
      res = await runUpdate(fallback);
    }

    const row = unwrap(res, 'atualizar a transação');
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
      card_id: input.cardId ?? null,
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
   * vez. Com `manual = true` (edição em massa feita à mão), marca também
   * `manual_category` para proteger a escolha da aplicação de regras ao
   * histórico. Com `manual = false` (regras/automático), NÃO mexe na flag.
   */
  async setCategoryMany(
    ids: string[],
    categoryId: string | null,
    manual = false
  ): Promise<void> {
    // Atualiza em lotes para não estourar limites de URL/tamanho da query.
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      if (part.length === 0) continue;
      const run = (payload: { category_id: string | null; manual_category?: boolean }) =>
        supabase.from(TABLE).update(payload).in('id', part);

      let res = await run(
        manual
          ? { category_id: categoryId, manual_category: true }
          : { category_id: categoryId }
      );
      if (res.error && manual && isMissingManualColumn(res.error))
        res = await run({ category_id: categoryId });

      unwrap(res, 'atualizar as categorias');
    }
  },

  /** Remove várias transações de uma vez (em lotes). */
  async removeMany(ids: string[]): Promise<void> {
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      if (part.length === 0) continue;
      unwrap(
        await supabase.from(TABLE).delete().in('id', part),
        'excluir as transações'
      );
    }
  },

  /**
   * Resumo financeiro (receitas, despesas e saldo) no período, agregado no
   * BANCO (RPC `financial_summary`) — não baixa o histórico para o cliente.
   * Exclui pagamentos de fatura (categorias tipo `credit_card`).
   */
  async summary(period: TransactionFilters = {}): Promise<FinancialSummary> {
    const data = unwrap(
      await supabase.rpc('financial_summary', {
        p_from: period.from ?? null,
        p_to: period.to ?? null,
      }),
      'calcular o resumo'
    );
    const row = data[0] ?? { income: 0, expense: 0 };
    const income = Number(row.income) || 0;
    const expense = Number(row.expense) || 0;
    return { income, expense, balance: income - expense };
  },
};
