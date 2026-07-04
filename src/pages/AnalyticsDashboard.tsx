import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import { expandCategorySelection } from '../domain/entities/Category';
import type { Transaction } from '../domain/entities/Transaction';
import { expenseByCategory } from '../domain/analytics';
import {
  buildInsights,
  buildSeries,
  computeStats,
  cumulativeNet,
  yearlyTotals,
  type GroupBy,
  type Insight,
} from '../domain/dashboardAnalytics';
import { UNCATEGORIZED } from '../components/filters/CategoryFilter';
import type { Period } from '../components/filters/PeriodNavigator';
import { DashboardFilters } from '../components/dashboard/DashboardFilters';
import { IncomeExpenseBarChart } from '../components/dashboard/IncomeExpenseBarChart';
import { ExpenseDonutChart } from '../components/dashboard/ExpenseDonutChart';
import { CumulativeBalanceChart } from '../components/dashboard/CumulativeBalanceChart';
import { TopCategoriesChart } from '../components/dashboard/TopCategoriesChart';
import { YearlyComparisonChart } from '../components/dashboard/YearlyComparisonChart';
import {
  formatCurrency,
  formatCurrencyAccounting,
} from '../lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
const CURRENT: Period = { month: now.getMonth(), year: now.getFullYear() };
const toIndex = (p: Period) => p.year * 12 + p.month;
const fromIndex = (i: number): Period => ({
  year: Math.floor(i / 12),
  month: i % 12,
});

const MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const periodLabel = (p: Period) =>
  `${MONTH_SHORT.format(new Date(p.year, p.month, 1)).replace('.', '')}/${String(
    p.year
  ).slice(2)}`;

/** Página Dashboard: análises e insights com filtros de período inteligentes. */
export default function AnalyticsDashboard() {
  const toast = useToast();

  const { categories } = useReferenceData();
  const [min, setMin] = useState<Period>(CURRENT);
  const [from, setFrom] = useState<Period>(fromIndex(toIndex(CURRENT) - 11));
  const [to, setTo] = useState<Period>(CURRENT);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Ordena o intervalo (caso "De" fique depois de "Até").
  const [f, t] = useMemo<[Period, Period]>(
    () => (toIndex(from) <= toIndex(to) ? [from, to] : [to, from]),
    [from, to]
  );
  const fromDate = useMemo(() => new Date(f.year, f.month, 1), [f]);
  const toDate = useMemo(() => new Date(t.year, t.month, 1), [t]);

  // Menor mês com dados (para o preset "Tudo"). Categorias vêm do cache.
  useEffect(() => {
    let active = true;
    transactionService.monthsWithData().then((months) => {
      if (!active) return;
      const keys = [...months].sort();
      if (keys[0]) {
        const [y, m] = keys[0].split('-').map(Number);
        setMin({ year: y, month: m - 1 });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Carrega os lançamentos do intervalo selecionado.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const start = iso(new Date(f.year, f.month, 1));
    const end = iso(new Date(t.year, t.month + 1, 0));
    transactionService
      .list({ from: start, to: end })
      .then((list) => {
        if (active) setTransactions(list);
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Falha ao carregar os dados.'
          );
          setTransactions([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [f, t, toast]);

  // Selecionar uma categoria-pai inclui as subcategorias.
  const effectiveCats = useMemo(
    () => expandCategorySelection(selectedCats, categories),
    [selectedCats, categories]
  );
  const visibleTx = useMemo(() => {
    if (effectiveCats.size === 0) return transactions;
    return transactions.filter((tx) =>
      effectiveCats.has(tx.categoryId ?? UNCATEGORIZED)
    );
  }, [transactions, effectiveCats]);

  const series = useMemo(
    () => buildSeries(visibleTx, fromDate, toDate, groupBy),
    [visibleTx, fromDate, toDate, groupBy]
  );
  const cumulative = useMemo(() => cumulativeNet(series), [series]);
  const catSlices = useMemo(() => expenseByCategory(visibleTx), [visibleTx]);
  const topCats = useMemo(() => catSlices.slice(0, 8), [catSlices]);
  const years = useMemo(() => yearlyTotals(visibleTx), [visibleTx]);
  const stats = useMemo(
    () => computeStats(series, catSlices, fromDate, toDate),
    [series, catSlices, fromDate, toDate]
  );
  const insights = useMemo(
    () => buildInsights(stats, series),
    [stats, series]
  );

  const rangeLabel = `${periodLabel(f)} – ${periodLabel(t)}`;
  const savingsPct = `${Math.round(stats.savingsRate * 100)}%`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Análises e insights do período — {rangeLabel}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <DashboardFilters
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          min={min}
          categories={categories}
          selectedCategories={selectedCats}
          onCategoriesChange={setSelectedCats}
        />

        <div className="min-w-0 space-y-6">
          {/* KPIs */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Receitas" value={formatCurrency(stats.totalIncome)} tone="income" />
            <Stat label="Despesas" value={formatCurrency(stats.totalExpense)} tone="expense" />
            <Stat
              label="Saldo"
              value={formatCurrencyAccounting(stats.net)}
              tone={stats.net >= 0 ? 'income' : 'expense'}
            />
            <Stat
              label="Taxa de poupança"
              value={savingsPct}
              tone={stats.net >= 0 ? 'income' : 'expense'}
              hint="Do total de receitas"
            />
            <Stat
              label="Despesas / mês"
              value={formatCurrency(stats.avgExpense)}
              hint={`Média em ${stats.months} mês(es)`}
            />
            <Stat
              label="Maior categoria"
              value={stats.topCategory?.name ?? '—'}
              hint={
                stats.topCategory
                  ? formatCurrency(stats.topCategory.value)
                  : undefined
              }
            />
          </section>

          {/* Gráficos */}
          <section className="grid gap-4 sm:gap-5 xl:grid-cols-2">
            <Panel title="Receitas vs. Despesas" subtitle={rangeLabel} className="xl:col-span-2">
              {loading ? <Loading /> : <IncomeExpenseBarChart data={series} />}
            </Panel>

            <Panel title="Saldo acumulado" subtitle="Soma corrente do resultado" className="xl:col-span-2">
              {loading ? <Loading /> : <CumulativeBalanceChart data={cumulative} />}
            </Panel>

            <Panel title="Despesas por categoria" subtitle={rangeLabel}>
              {loading ? <Loading /> : <ExpenseDonutChart data={catSlices} />}
            </Panel>

            <Panel title="Maiores categorias de despesa">
              {loading ? <Loading /> : <TopCategoriesChart data={topCats} />}
            </Panel>

            {years.length > 1 && (
              <Panel title="Comparativo anual" className="xl:col-span-2">
                {loading ? <Loading /> : <YearlyComparisonChart data={years} />}
              </Panel>
            )}

            <Panel title="Insights" className="xl:col-span-2">
              <InsightsGrid insights={insights} />
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'income' | 'expense' | 'neutral';
  hint?: string;
}) {
  const color =
    tone === 'income'
      ? 'text-brand-income'
      : tone === 'expense'
        ? 'text-brand-expense'
        : 'text-brand-moss';
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <p className="text-sm font-medium text-brand-gray">{label}</p>
      <p className={`mt-1 truncate text-xl font-bold tracking-tight ${color}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-brand-gray">{hint}</p>}
    </div>
  );
}

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

function Panel({ title, subtitle, className = '', children }: PanelProps) {
  return (
    <div
      className={`rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card sm:p-6 ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-brand-moss">{title}</h2>
        {subtitle && (
          <p className="text-xs capitalize text-brand-gray">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-brand-gray">
      Carregando…
    </div>
  );
}

function InsightsGrid({ insights }: { insights: Insight[] }) {
  const dot: Record<Insight['tone'], string> = {
    positive: 'bg-brand-income',
    negative: 'bg-brand-expense',
    neutral: 'bg-brand-aqua',
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {insights.map((ins) => (
        <div
          key={ins.title}
          className="flex gap-3 rounded-xl border border-brand-moss/10 bg-brand-light/50 p-3"
        >
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot[ins.tone]}`} />
          <div>
            <p className="text-sm font-semibold text-brand-moss">{ins.title}</p>
            <p className="text-sm text-brand-gray">{ins.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
