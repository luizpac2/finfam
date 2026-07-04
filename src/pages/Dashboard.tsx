import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import type { Transaction } from '../domain/entities/Transaction';
import {
  buildMonthlySeries,
  expenseByCategory,
  monthTotals,
} from '../domain/analytics';
import { KpiCard } from '../components/dashboard/KpiCard';
import { IncomeExpenseBarChart } from '../components/dashboard/IncomeExpenseBarChart';
import { ExpenseDonutChart } from '../components/dashboard/ExpenseDonutChart';
import { FilterSidebar } from '../components/filters/FilterSidebar';
import { UNCATEGORIZED } from '../components/filters/CategoryFilter';
import type { Period } from '../components/filters/PeriodNavigator';
import {
  BarChartSkeleton,
  DonutChartSkeleton,
  KpiCardSkeleton,
} from '../components/dashboard/DashboardSkeletons';

const MONTHS_WINDOW = 6;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();

/**
 * Visão geral financeira da família: filtro de período + KPIs + gráfico de
 * barras (6 meses até o período) + rosca de despesas por categoria.
 */
export default function Dashboard() {
  const { profile, email } = useAuth();
  const toast = useToast();

  const [period, setPeriod] = useState<Period>({
    month: now.getMonth(),
    year: now.getFullYear(),
  });
  const [windowTx, setWindowTx] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const { categories, loadingCategories } = useReferenceData();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [monthsWithData, setMonthsWithData] = useState<Set<string>>();

  const refDate = useMemo(
    () => new Date(period.year, period.month, 1),
    [period]
  );

  // Meses com lançamentos para o filtro lateral (categorias vêm do cache).
  useEffect(() => {
    let active = true;
    transactionService.monthsWithData().then((s) => {
      if (active) setMonthsWithData(s);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const windowStart = isoDate(
      new Date(period.year, period.month - (MONTHS_WINDOW - 1), 1)
    );
    const periodEnd = isoDate(new Date(period.year, period.month + 1, 0));

    (async () => {
      try {
        const [summary, list] = await Promise.all([
          transactionService.summary({ to: periodEnd }), // saldo acumulado até o mês
          transactionService.list({ from: windowStart, to: periodEnd }),
        ]);
        if (!active) return;
        setTotalBalance(summary.balance);
        setWindowTx(list);
      } catch (err) {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Falha ao carregar o painel.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [period, toast]);

  // Aplica o filtro de categorias às agregações do período (o saldo total em
  // conta permanece global, pois representa o acumulado de todas as categorias).
  const visibleTx = useMemo(() => {
    if (selectedCats.size === 0) return windowTx;
    return windowTx.filter((tx) =>
      selectedCats.has(tx.categoryId ?? UNCATEGORIZED)
    );
  }, [windowTx, selectedCats]);

  const series = useMemo(
    () => buildMonthlySeries(visibleTx, MONTHS_WINDOW, refDate),
    [visibleTx, refDate]
  );
  const monthSummary = useMemo(
    () => monthTotals(visibleTx, refDate),
    [visibleTx, refDate]
  );
  const byCategory = useMemo(() => expenseByCategory(visibleTx), [visibleTx]);

  const firstName = (profile?.fullName || email || '').split(' ')[0];
  const windowLabel = `6 meses até ${new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
  }).format(refDate)}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          {firstName ? `Olá, ${firstName}` : 'Visão geral'}
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Acompanhe as finanças da família por período.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <FilterSidebar
          period={period}
          onPeriodChange={setPeriod}
          categories={categories}
          selectedCategories={selectedCats}
          onCategoriesChange={setSelectedCats}
          loadingCategories={loadingCategories}
          monthsWithData={monthsWithData}
        />

        <div className="space-y-6">
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
                  hint="Saldo acumulado no período"
                />
                <KpiCard
                  label="Receitas do mês"
                  value={monthSummary.income}
                  icon={TrendingUp}
                  accent="income"
                />
                <KpiCard
                  label="Despesas do mês"
                  value={-monthSummary.expense}
                  icon={TrendingDown}
                  accent="expense"
                />
              </>
            )}
          </section>

          {/* Gráficos */}
          <section className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            <Panel
              title="Receitas vs. Despesas"
              subtitle={windowLabel}
              className="xl:col-span-2"
            >
              {loading ? (
                <BarChartSkeleton />
              ) : (
                <IncomeExpenseBarChart data={series} />
              )}
            </Panel>

            <Panel
              title="Despesas por categoria"
              subtitle={windowLabel}
              className="xl:col-span-1"
            >
              {loading ? (
                <DonutChartSkeleton />
              ) : (
                <ExpenseDonutChart data={byCategory} />
              )}
            </Panel>
          </section>
        </div>
      </div>
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
        {subtitle && <p className="text-xs capitalize text-brand-gray">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
