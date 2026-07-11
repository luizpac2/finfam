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
import {
  CategoryFilter,
  UNCATEGORIZED,
} from '../components/filters/CategoryFilter';
import { FilterCard } from '../components/filters/FilterCard';
import { YearPeriodFilter } from '../components/filters/YearPeriodFilter';
import { IncomeExpenseBarChart } from '../components/dashboard/IncomeExpenseBarChart';
import { CategoryBarChart } from '../components/dashboard/CategoryBarChart';
import { CumulativeBalanceChart } from '../components/dashboard/CumulativeBalanceChart';
import { TopCategoriesChart } from '../components/dashboard/TopCategoriesChart';
import { YearlyComparisonChart } from '../components/dashboard/YearlyComparisonChart';
import { formatCurrency, formatCurrencyAccounting } from '../lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth(); // 0-based

const TOP_N = 8;

/**
 * Página Dashboard: análises e insights. O período é por **ano** — o MESMO
 * filtro da Visão geral (`YearPeriodFilter`): um ou vários anos, ou "todo o
 * período". Um ano só → série mensal; vários anos → série anual.
 */
export default function AnalyticsDashboard() {
  const toast = useToast();
  const { categories, loadingCategories } = useReferenceData();

  const [availableYears, setAvailableYears] = useState<number[]>([CURRENT_YEAR]);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(
    new Set([CURRENT_YEAR])
  );
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [rangeTx, setRangeTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const yearsSorted = useMemo(
    () => [...selectedYears].sort((a, b) => a - b),
    [selectedYears]
  );
  const minYear = yearsSorted[0] ?? CURRENT_YEAR;
  const maxYear = yearsSorted[yearsSorted.length - 1] ?? CURRENT_YEAR;
  const isAllPeriod =
    availableYears.length > 0 && selectedYears.size === availableYears.length;

  // Anos que têm lançamentos (opções do período). Default: o mais recente.
  useEffect(() => {
    let active = true;
    transactionService.monthsWithData().then((months) => {
      if (!active) return;
      const years = [
        ...new Set([...months].map((m) => Number(m.slice(0, 4)))),
      ].sort((a, b) => a - b);
      if (years.length) {
        setAvailableYears(years);
        setSelectedYears(new Set([years[years.length - 1]]));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Carrega os lançamentos do intervalo [minAno, maxAno]; o recorte fino por
  // ano/categoria é feito em memória.
  useEffect(() => {
    let active = true;
    setLoading(true);
    transactionService
      .list({
        from: `${minYear}-01-01`,
        to: isoDate(new Date(maxYear, 11, 31)),
      })
      .then((list) => {
        if (active) setRangeTx(list);
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Falha ao carregar os dados.'
          );
          setRangeTx([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [minYear, maxYear, toast]);

  // Recorte por ano + filtro de categorias (pai inclui subcategorias).
  const effectiveCats = useMemo(
    () => expandCategorySelection(selectedCats, categories),
    [selectedCats, categories]
  );
  const visibleTx = useMemo(
    () =>
      rangeTx.filter((tx) => {
        if (!selectedYears.has(Number(tx.date.slice(0, 4)))) return false;
        if (effectiveCats.size === 0) return true;
        return effectiveCats.has(tx.categoryId ?? UNCATEGORIZED);
      }),
    [rangeTx, selectedYears, effectiveCats]
  );

  // Um ano → série mensal; vários anos → série anual (só os selecionados).
  const groupBy: GroupBy = selectedYears.size <= 1 ? 'month' : 'year';
  const fromDate = useMemo(() => new Date(minYear, 0, 1), [minYear]);
  const toDate = useMemo(() => new Date(maxYear, 11, 1), [maxYear]);
  const series = useMemo(() => {
    const s = buildSeries(visibleTx, fromDate, toDate, groupBy);
    return groupBy === 'year'
      ? s.filter((p) => selectedYears.has(Number(p.key)))
      : s;
  }, [visibleTx, fromDate, toDate, groupBy, selectedYears]);

  // Meses decorridos nos anos escolhidos (para as médias mensais).
  const monthsCount = useMemo(() => {
    let m = 0;
    for (const y of selectedYears) {
      if (y < CURRENT_YEAR) m += 12;
      else if (y === CURRENT_YEAR) m += CURRENT_MONTH + 1;
    }
    return Math.max(m, 1);
  }, [selectedYears]);

  const cumulative = useMemo(() => cumulativeNet(series), [series]);
  const catSlices = useMemo(() => expenseByCategory(visibleTx), [visibleTx]);
  const topCats = useMemo(() => catSlices.slice(0, TOP_N), [catSlices]);
  const years = useMemo(() => yearlyTotals(visibleTx), [visibleTx]);

  // Médias pelos meses REALMENTE selecionados (anos podem não ser contíguos).
  const stats = useMemo(() => {
    const base = computeStats(series, catSlices, fromDate, toDate);
    return {
      ...base,
      months: monthsCount,
      avgIncome: base.totalIncome / monthsCount,
      avgExpense: base.totalExpense / monthsCount,
    };
  }, [series, catSlices, fromDate, toDate, monthsCount]);

  const insights = useMemo(() => buildInsights(stats, series), [stats, series]);

  const periodLabel =
    selectedYears.size === 0
      ? 'Nenhum ano'
      : isAllPeriod
        ? 'Todo o período'
        : yearsSorted.length === 1
          ? String(yearsSorted[0])
          : yearsSorted.join(' · ');
  const savingsPct = `${Math.round(stats.savingsRate * 100)}%`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Análises e insights — {periodLabel}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <YearPeriodFilter
            availableYears={availableYears}
            selected={selectedYears}
            onChange={setSelectedYears}
          />

          <FilterCard title="Categorias">
            <CategoryFilter
              categories={categories}
              selected={selectedCats}
              onChange={setSelectedCats}
              loading={loadingCategories}
            />
          </FilterCard>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* KPIs */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Receitas"
              value={formatCurrency(stats.totalIncome)}
              tone="income"
            />
            <Stat
              label="Despesas"
              value={formatCurrency(stats.totalExpense)}
              tone="expense"
            />
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

          {/* Gráficos — barras verticais ocupam a linha inteira */}
          <section className="grid gap-4 sm:gap-5 xl:grid-cols-2">
            <Panel
              title="Receitas vs. Despesas"
              subtitle={groupBy === 'month' ? 'Por mês' : 'Por ano'}
              className="xl:col-span-2"
            >
              {loading ? <Loading /> : <IncomeExpenseBarChart data={series} />}
            </Panel>

            <Panel
              title="Saldo acumulado"
              subtitle="Soma corrente do resultado"
              className="xl:col-span-2"
            >
              {loading ? <Loading /> : <CumulativeBalanceChart data={cumulative} />}
            </Panel>

            <Panel
              title="Despesas por categoria"
              subtitle="Total no período"
              className="xl:col-span-2"
            >
              {loading ? <Loading /> : <CategoryBarChart data={topCats} />}
            </Panel>

            <Panel
              title="Maiores categorias de despesa"
              className="xl:col-span-2"
            >
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
        {subtitle && <p className="text-xs text-brand-gray">{subtitle}</p>}
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
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot[ins.tone]}`}
          />
          <div>
            <p className="text-sm font-semibold text-brand-moss">{ins.title}</p>
            <p className="text-sm text-brand-gray">{ins.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
