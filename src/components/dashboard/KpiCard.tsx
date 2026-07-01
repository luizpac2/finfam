import type { LucideIcon } from 'lucide-react';

import { formatCurrency } from '../../lib/format';

export type KpiAccent = 'income' | 'expense' | 'balance';

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: KpiAccent;
  hint?: string;
}

const valueColor = (accent: KpiAccent, value: number): string => {
  if (accent === 'income') return 'text-brand-aqua';
  if (accent === 'expense') return 'text-brand-moss';
  return value >= 0 ? 'text-brand-aqua' : 'text-red-500';
};

const chipColor: Record<KpiAccent, string> = {
  income: 'bg-brand-aqua/20 text-brand-moss',
  expense: 'bg-brand-moss/15 text-brand-moss',
  balance: 'bg-brand-aqua/20 text-brand-moss',
};

/** Cartão de indicador (KPI) com bastante respiro e sombra suave. */
export function KpiCard({ label, value, icon: Icon, accent, hint }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-brand-gray">{label}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${chipColor[accent]}`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>
      <p className={`mt-4 text-2xl font-bold tracking-tight sm:text-3xl ${valueColor(accent, value)}`}>
        {formatCurrency(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-brand-gray">{hint}</p>}
    </div>
  );
}
