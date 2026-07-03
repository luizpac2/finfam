import type { Transaction } from './entities/Transaction';
import { isCountable, type CategorySlice } from './analytics';

/**
 * Agregações para a página de Dashboard (análises): séries por mês/ano, saldo
 * acumulado, comparativo anual, estatísticas e insights. Puro e testável.
 */

export type GroupBy = 'month' | 'year';

export interface SeriesPoint {
  key: string; // 'YYYY-MM' ou 'YYYY'
  label: string;
  income: number;
  expense: number;
  net: number;
}

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, '0');

/** Série de receitas/despesas/saldo por mês ou ano, no intervalo [from, to]. */
export const buildSeries = (
  txs: Transaction[],
  from: Date,
  to: Date,
  groupBy: GroupBy
): SeriesPoint[] => {
  const points = new Map<string, SeriesPoint>();
  const order: string[] = [];

  if (groupBy === 'month') {
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (d <= end) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const label = `${cap(monthShort.format(d).replace('.', ''))}/${String(
        d.getFullYear()
      ).slice(2)}`;
      points.set(key, { key, label, income: 0, expense: 0, net: 0 });
      order.push(key);
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y += 1) {
      const key = String(y);
      points.set(key, { key, label: key, income: 0, expense: 0, net: 0 });
      order.push(key);
    }
  }

  for (const tx of txs) {
    if (!isCountable(tx)) continue;
    const key = groupBy === 'month' ? tx.date.slice(0, 7) : tx.date.slice(0, 4);
    const point = points.get(key);
    if (!point) continue;
    if (tx.type === 'income') point.income += tx.amount;
    else point.expense += tx.amount;
  }

  for (const key of order) {
    const p = points.get(key)!;
    p.net = p.income - p.expense;
  }
  return order.map((k) => points.get(k)!);
};

export interface CumulativePoint {
  key: string;
  label: string;
  balance: number;
}

/** Saldo acumulado (soma corrente do net) ao longo da série. */
export const cumulativeNet = (series: SeriesPoint[]): CumulativePoint[] => {
  let running = 0;
  return series.map((p) => {
    running += p.net;
    return { key: p.key, label: p.label, balance: running };
  });
};

export interface YearTotals {
  year: string;
  income: number;
  expense: number;
  net: number;
}

/** Totais por ano (para o comparativo anual). */
export const yearlyTotals = (txs: Transaction[]): YearTotals[] => {
  const byYear = new Map<string, YearTotals>();
  for (const tx of txs) {
    if (!isCountable(tx)) continue;
    const year = tx.date.slice(0, 4);
    const y =
      byYear.get(year) ?? { year, income: 0, expense: 0, net: 0 };
    if (tx.type === 'income') y.income += tx.amount;
    else y.expense += tx.amount;
    y.net = y.income - y.expense;
    byYear.set(year, y);
  }
  return [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year));
};

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  net: number;
  months: number;
  avgIncome: number;
  avgExpense: number;
  savingsRate: number; // 0–1
  topCategory?: CategorySlice;
  peakExpense?: SeriesPoint;
}

/** Nº de meses (inclusive) entre duas datas. */
export const monthSpan = (from: Date, to: Date): number =>
  (to.getFullYear() - from.getFullYear()) * 12 +
  (to.getMonth() - from.getMonth()) +
  1;

export const computeStats = (
  series: SeriesPoint[],
  categorySlices: CategorySlice[],
  from: Date,
  to: Date
): DashboardStats => {
  const totalIncome = series.reduce((s, p) => s + p.income, 0);
  const totalExpense = series.reduce((s, p) => s + p.expense, 0);
  const months = Math.max(monthSpan(from, to), 1);
  const peakExpense = series.reduce<SeriesPoint | undefined>(
    (max, p) => (!max || p.expense > max.expense ? p : max),
    undefined
  );
  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    months,
    avgIncome: totalIncome / months,
    avgExpense: totalExpense / months,
    savingsRate: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0,
    topCategory: categorySlices[0],
    peakExpense: peakExpense && peakExpense.expense > 0 ? peakExpense : undefined,
  };
};

export interface Insight {
  title: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v);

/** Gera insights textuais a partir das estatísticas e da série. */
export const buildInsights = (
  stats: DashboardStats,
  series: SeriesPoint[]
): Insight[] => {
  const out: Insight[] = [];

  out.push({
    title: 'Taxa de poupança',
    detail:
      stats.totalIncome > 0
        ? `Você guardou ${Math.round(stats.savingsRate * 100)}% das receitas (${brl(
            stats.net
          )}).`
        : 'Sem receitas no período para calcular.',
    tone: stats.net >= 0 ? 'positive' : 'negative',
  });

  if (stats.topCategory) {
    out.push({
      title: 'Maior categoria de despesa',
      detail: `${stats.topCategory.name}: ${brl(stats.topCategory.value)}.`,
      tone: 'neutral',
    });
  }

  if (stats.peakExpense) {
    out.push({
      title: 'Período de maior gasto',
      detail: `${stats.peakExpense.label} — ${brl(stats.peakExpense.expense)}.`,
      tone: 'neutral',
    });
  }

  // Tendência: último período vs média de despesas.
  const last = series[series.length - 1];
  if (last && stats.avgExpense > 0 && series.length >= 2) {
    const diff = (last.expense - stats.avgExpense) / stats.avgExpense;
    const pct = Math.round(Math.abs(diff) * 100);
    out.push({
      title: 'Tendência de despesas',
      detail:
        diff >= 0
          ? `${last.label} ficou ${pct}% acima da média do período.`
          : `${last.label} ficou ${pct}% abaixo da média do período.`,
      tone: diff <= 0 ? 'positive' : 'negative',
    });
  }

  out.push({
    title: 'Média mensal',
    detail: `Receitas ${brl(stats.avgIncome)} · Despesas ${brl(
      stats.avgExpense
    )} por mês.`,
    tone: 'neutral',
  });

  return out;
};
