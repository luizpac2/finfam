import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import { expandCategorySelection } from '../domain/entities/Category';
import type { Transaction } from '../domain/entities/Transaction';
import { expenseByCategory, isCountable } from '../domain/analytics';
import { buildSeries, type GroupBy } from '../domain/dashboardAnalytics';
import { KpiCard } from '../components/dashboard/KpiCard';
import { IncomeExpenseBarChart } from '../components/dashboard/IncomeExpenseBarChart';
import { CategoryBarChart } from '../components/dashboard/CategoryBarChart';
import { CategoryFilter, UNCATEGORIZED } from '../components/filters/CategoryFilter';
import {
  BarChartSkeleton,
  KpiCardSkeleton,
} from '../components/dashboard/DashboardSkeletons';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth(); // 0-based

const TOP_N = 8;

/**
 * Visão geral financeira da família. O período é por **ano**: dá para escolher
 * um ou vários anos ao mesmo tempo, ou "todo o período". Um ano só → série
 * mensal; vários anos → série anual. KPIs + gráficos de barras (Receitas x
 * Despesas, Despesas por categoria e Média mensal por categoria).
 */
export default function Dashboard() {
  const { profile, email } = useAuth();
  const toast = useToast();
  const { categories, loadingCategories } = useReferenceData();

  const [availableYears, setAvailableYears] = useState<number[]>([CURRENT_YEAR]);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(
    new Set([CURRENT_YEAR])
  );
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const [rangeTx, setRangeTx] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const yearsSorted = useMemo(
    () => [...selectedYears].sort((a, b) => a - b),
    [selectedYears]
  );
  const minYear = yearsSorted[0] ?? CURRENT_YEAR;
  const maxYear = yearsSorted[yearsSorted.length - 1] ?? CURRENT_YEAR;
  const isAllPeriod =
    availableYears.length > 0 && selectedYears.size === availableYears.length;

  // Anos que têm lançamentos (para as opções de período). Default: o mais recente.
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

  // Carrega os lançamentos do intervalo [minAno, maxAno] e o saldo acumulado até
  // o fim do período. O recorte fino por ano/categoria é feito em memória.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const from = `${minYear}-01-01`;
    const to = isoDate(new Date(maxYear, 11, 31));

    (async () => {
      try {
        const [summary, list] = await Promise.all([
          transactionService.summary({ to }),
          transactionService.list({ from, to }),
        ]);
        if (!active) return;
        setTotalBalance(summary.balance);
        setRangeTx(list);
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Falha ao carregar o painel.'
          );
          setRangeTx([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [minYear, maxYear, toast]);

  // Recorte por ano selecionado + filtro de categorias (pai inclui subcategorias).
  const effectiveCats = useMemo(
    () => expandCategorySelection(selectedCats, categories),
    [selectedCats, categories]
  );
  const visibleTx = useMemo(() => {
    return rangeTx.filter((tx) => {
      if (!selectedYears.has(Number(tx.date.slice(0, 4)))) return false;
      if (effectiveCats.size === 0) return true;
      return effectiveCats.has(tx.categoryId ?? UNCATEGORIZED);
    });
  }, [rangeTx, selectedYears, effectiveCats]);

  // Um ano → série mensal; vários anos → série anual (filtrada aos selecionados).
  const groupBy: GroupBy = selectedYears.size <= 1 ? 'month' : 'year';
  const series = useMemo(() => {
    const fromDate = new Date(minYear, 0, 1);
    const toDate = new Date(maxYear, 11, 1);
    const s = buildSeries(visibleTx, fromDate, toDate, groupBy);
    return groupBy === 'year'
      ? s.filter((p) => selectedYears.has(Number(p.key)))
      : s;
  }, [visibleTx, minYear, maxYear, groupBy, selectedYears]);

  // Nº de meses decorridos no período (para a média mensal por categoria).
  const monthsCount = useMemo(() => {
    let m = 0;
    for (const y of selectedYears) {
      if (y < CURRENT_YEAR) m += 12;
      else if (y === CURRENT_YEAR) m += CURRENT_MONTH + 1;
    }
    return Math.max(m, 1);
  }, [selectedYears]);

  const byCategory = useMemo(() => expenseByCategory(visibleTx), [visibleTx]);
  const topCats = useMemo(() => byCategory.slice(0, TOP_N), [byCategory]);
  const avgCats = useMemo(
    () =>
      byCategory
        .slice(0, TOP_N)
        .map((c) => ({ ...c, value: c.value / monthsCount })),
    [byCategory, monthsCount]
  );

  const totals = useMemo(
    () =>
      visibleTx.reduce(
        (acc, tx) => {
          if (!isCountable(tx)) return acc;
          if (tx.type === 'income') acc.income += tx.amount;
          else acc.expense += tx.amount;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [visibleTx]
  );

  const firstName = (profile?.fullName || email || '').split(' ')[0];
  const periodLabel =
    selectedYears.size === 0
      ? 'Nenhum ano'
      : isAllPeriod
        ? 'Todo o período'
        : yearsSorted.length === 1
          ? String(yearsSorted[0])
          : yearsSorted.join(' · ');

  const toggleYear = (year: number) =>
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          {firstName ? `Olá, ${firstName}` : 'Visão geral'}
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Finanças da família — {periodLabel}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FilterCard title="Período">
            <button
              type="button"
              onClick={() => setSelectedYears(new Set(availableYears))}
              className={`mb-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
                isAllPeriod
                  ? 'bg-brand-aqua/15 text-brand-moss'
                  : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
              }`}
            >
              Todo o período
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {availableYears
                .slice()
                .sort((a, b) => b - a)
                .map((year) => {
                  const active = selectedYears.has(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => toggleYear(year)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2 py-1.5 text-sm font-medium tabular-nums transition ${
                        active
                          ? 'border-brand-aqua bg-brand-aqua/15 text-brand-moss'
                          : 'border-brand-moss/15 text-brand-gray hover:border-brand-aqua/40 hover:text-brand-moss'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
            </div>
            <p className="mt-2 text-xs text-brand-gray">
              Escolha um ou mais anos.
            </p>
          </FilterCard>

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
          <section className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {loading ? (
              <>
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
              </>
            ) : (
              <>
                <KpiCard
                  label="Total em conta"
                  value={totalBalance}
                  icon={Wallet}
                  accent="balance"
                  hint="Saldo acumulado até o fim do período"
                />
                <KpiCard
                  label="Receitas do período"
                  value={totals.income}
                  icon={TrendingUp}
                  accent="income"
                />
                <KpiCard
                  label="Despesas do período"
                  value={-totals.expense}
                  icon={TrendingDown}
                  accent="expense"
                />
              </>
            )}
          </section>

          {/* Gráficos */}
          <section className="space-y-4 sm:space-y-5">
            <Panel
              title="Receitas vs. Despesas"
              subtitle={groupBy === 'month' ? 'Por mês' : 'Por ano'}
            >
              {loading ? (
                <BarChartSkeleton />
              ) : (
                <IncomeExpenseBarChart data={series} />
              )}
            </Panel>

            <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
              <Panel title="Despesas por categoria" subtitle="Total no período">
                {loading ? (
                  <BarChartSkeleton />
                ) : (
                  <CategoryBarChart data={topCats} valueLabel="Total" />
                )}
              </Panel>

              <Panel
                title="Média mensal por categoria"
                subtitle={`Por mês · ${monthsCount} ${
                  monthsCount === 1 ? 'mês' : 'meses'
                }`}
              >
                {loading ? (
                  <BarChartSkeleton />
                ) : (
                  <CategoryBarChart data={avgCats} valueLabel="Média/mês" />
                )}
              </Panel>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FilterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
        {title}
      </h2>
      {children}
    </div>
  );
}

interface PanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

/** Cartão de conteúdo com título — base visual dos gráficos. */
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
