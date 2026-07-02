import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MonthlyPoint } from '../../domain/analytics';
import { formatCurrencyShort } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

const SERIES_LABELS: Record<string, string> = {
  income: 'Receitas',
  expense: 'Despesas',
};

/** Gráfico de barras: Receitas x Despesas dos últimos meses. */
export function IncomeExpenseBarChart({ data }: { data: MonthlyPoint[] }) {
  const hasData = data.some((point) => point.income > 0 || point.expense > 0);

  if (!hasData) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-brand-gray">
        Sem dados no período.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#6D736814" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrencyShort(Number(value))}
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: '#6D73680d' }}
            content={<ChartTooltip labels={SERIES_LABELS} />}
          />
          <Legend
            iconType="circle"
            formatter={(value) => SERIES_LABELS[String(value)] ?? value}
            wrapperStyle={{ fontSize: 12, color: '#6D7368', paddingTop: 8 }}
          />
          <Bar dataKey="income" fill="#15966B" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expense" fill="#D64550" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
