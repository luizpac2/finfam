import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CategorySlice } from '../../domain/analytics';
import { formatCurrencyShort } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

const truncate = (s: string, n = 12) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

interface CategoryBarChartProps {
  data: CategorySlice[];
  /** Rótulo da série no tooltip (ex.: "Total", "Média/mês"). */
  valueLabel?: string;
}

/** Despesas por categoria em barras verticais, cada barra na cor da categoria. */
export function CategoryBarChart({
  data,
  valueLabel = 'Total',
}: CategoryBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-brand-gray">
        Sem despesas no período.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#6D736814" />
          <XAxis
            dataKey="name"
            interval={0}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6D7368', fontSize: 11 }}
            tickFormatter={(v) => truncate(String(v))}
            angle={-35}
            textAnchor="end"
            height={64}
          />
          <YAxis
            tickFormatter={(v) => formatCurrencyShort(Number(v))}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: '#8C888A', fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: '#6D73680d' }} content={<ChartTooltip />} />
          <Bar dataKey="value" name={valueLabel} radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
