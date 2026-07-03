import type { Transaction } from './entities/Transaction';

/**
 * Agregações puras sobre transações para alimentar a UI/gráficos.
 * Sem dependências externas — fáceis de testar isoladamente.
 */

export interface MonthlyPoint {
  /** Chave estável (YYYY-MM). */
  key: string;
  /** Rótulo curto para o eixo (ex.: "Jan"). */
  label: string;
  income: number;
  expense: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
}

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (date: Date): string => {
  const label = monthShort.format(date).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * Uma transação entra nos agregados se não estiver cancelada e não for um
 * pagamento de fatura de cartão (categoria tipo `credit_card`) — este último
 * é ignorado para não duplicar as compras já lançadas como despesas.
 */
export const isCountable = (tx: Transaction): boolean =>
  tx.status !== 'cancelled' && tx.category?.kind !== 'credit_card';

/** Paleta de fallback para categorias sem cor definida (mantém o tom da marca). */
const FALLBACK_COLORS = [
  '#9BBFB5',
  '#6D7368',
  '#8C888A',
  '#BFD3C1',
  '#A7B89E',
  '#C2A878',
];

/**
 * Série mensal (receitas x despesas) para os últimos `months` meses,
 * terminando no mês de `ref` (inclusive).
 */
export const buildMonthlySeries = (
  transactions: Transaction[],
  months = 6,
  ref: Date = new Date()
): MonthlyPoint[] => {
  const base = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const series: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    series.push({ key: monthKey(d), label: monthLabel(d), income: 0, expense: 0 });
  }

  const byKey = new Map(series.map((point) => [point.key, point]));
  for (const tx of transactions) {
    if (!isCountable(tx)) continue;
    const point = byKey.get(tx.date.slice(0, 7));
    if (!point) continue;
    if (tx.type === 'income') point.income += tx.amount;
    else point.expense += tx.amount;
  }
  return series;
};

/** Totais (receita, despesa, saldo) do mês de `ref`. */
export const monthTotals = (
  transactions: Transaction[],
  ref: Date = new Date()
): PeriodTotals => {
  const key = monthKey(ref);
  const totals = transactions.reduce(
    (acc, tx) => {
      if (!isCountable(tx) || tx.date.slice(0, 7) !== key) return acc;
      if (tx.type === 'income') acc.income += tx.amount;
      else acc.expense += tx.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  return { ...totals, balance: totals.income - totals.expense };
};

/** Distribuição de despesas por categoria, ordenada do maior para o menor. */
export const expenseByCategory = (
  transactions: Transaction[]
): CategorySlice[] => {
  const byName = new Map<string, CategorySlice>();
  for (const tx of transactions) {
    if (!isCountable(tx) || tx.type !== 'expense') continue;
    const name = tx.category?.name ?? 'Sem categoria';
    const existing = byName.get(name);
    if (existing) {
      existing.value += tx.amount;
    } else {
      byName.set(name, {
        name,
        value: tx.amount,
        color: tx.category?.color ?? FALLBACK_COLORS[byName.size % FALLBACK_COLORS.length],
      });
    }
  }
  return [...byName.values()].sort((a, b) => b.value - a.value);
};
