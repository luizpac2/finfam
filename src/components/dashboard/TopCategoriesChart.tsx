import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CategorySlice } from '../../domain/analytics';
import { formatCurrencyShort } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

/** Ranking horizontal das maiores categorias de despesa. */
export function TopCategoriesChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-brand-gray">
        Sem despesas no período.
      </div>
    );
  }

  const height = Math.max(data.length * 40, 140);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrencyShort(Number(v))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={116}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6D7368', fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: '#6D73680d' }} content={<ChartTooltip />} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
