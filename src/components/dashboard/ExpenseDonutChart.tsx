import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { CategorySlice } from '../../domain/analytics';
import { formatCurrency } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

/** Gráfico de rosca: distribuição de despesas por categoria, com legenda própria. */
export function ExpenseDonutChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-brand-gray">
        Sem despesas no período.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      {/* Rosca com total no centro */}
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-brand-gray">Total</span>
          <span className="text-lg font-bold text-brand-moss">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Legenda customizada */}
      <ul className="w-full flex-1 space-y-2.5">
        {data.map((slice) => {
          const percent = Math.round((slice.value / total) * 100);
          return (
            <li key={slice.name} className="flex items-center gap-3 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-brand-gray">
                {slice.name}
              </span>
              <span className="font-medium text-brand-moss">
                {formatCurrency(slice.value)}
              </span>
              <span className="w-10 text-right text-xs text-brand-gray">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
