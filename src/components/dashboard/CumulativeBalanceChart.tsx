import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { CumulativePoint } from '../../domain/dashboardAnalytics';
import { formatCurrencyShort } from '../../lib/format';
import { ChartTooltip } from './ChartTooltip';

const LABELS = { balance: 'Saldo acumulado' };

/** Área do saldo acumulado (soma corrente do resultado) ao longo do período. */
export function CumulativeBalanceChart({ data }: { data: CumulativePoint[] }) {
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
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9BBFB5" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#9BBFB5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#6D736814" />
          <XAxis
            dataKey="label"
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
          <ReferenceLine y={0} stroke="#8C888A" strokeDasharray="3 3" />
          <Tooltip content={<ChartTooltip labels={LABELS} />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#6D7368"
            strokeWidth={2}
            fill="url(#netFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
