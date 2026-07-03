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

import type { YearTotals } from '../../domain/dashboardAnalytics';
import { formatCurrencyShort } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

const LABELS: Record<string, string> = {
  income: 'Receitas',
  expense: 'Despesas',
};

/** Comparativo anual: receitas x despesas por ano. */
export function YearlyComparisonChart({ data }: { data: YearTotals[] }) {
  if (data.length === 0) {
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
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => formatCurrencyShort(Number(v))}
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: '#6D73680d' }}
            content={<ChartTooltip labels={LABELS} />}
          />
          <Legend
            iconType="circle"
            formatter={(value) => LABELS[String(value)] ?? value}
            wrapperStyle={{ fontSize: 12, color: '#6D7368', paddingTop: 8 }}
          />
          <Bar dataKey="income" fill="#15966B" radius={[6, 6, 0, 0]} maxBarSize={40} />
          <Bar dataKey="expense" fill="#D64550" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
