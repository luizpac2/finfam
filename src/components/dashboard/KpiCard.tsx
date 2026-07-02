import type { LucideIcon } from 'lucide-react';

import { formatCurrencyAccounting } from '../../lib/format';

export type KpiAccent = 'income' | 'expense' | 'balance';

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: KpiAccent;
  hint?: string;
}

const valueColor = (accent: KpiAccent, value: number): string => {
  if (accent === 'income') return 'text-brand-income';
  if (accent === 'expense') return 'text-brand-expense';
  return value >= 0 ? 'text-brand-income' : 'text-brand-expense';
};

const chipColor: Record<KpiAccent, string> = {
  income: 'bg-brand-income/15 text-brand-income',
  expense: 'bg-brand-expense/15 text-brand-expense',
  balance: 'bg-brand-aqua/25 text-brand-moss',
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
        {formatCurrencyAccounting(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-brand-gray">{hint}</p>}
    </div>
  );
}
