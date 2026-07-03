import type { ReactNode } from 'react';

import type { Category } from '../../domain/entities/Category';
import type { GroupBy } from '../../domain/dashboardAnalytics';
import type { Period } from '../filters/PeriodNavigator';
import { CategoryFilter } from '../filters/CategoryFilter';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(2020, i, 1))
    .replace('.', '')
);

const now = new Date();
const CURRENT: Period = { month: now.getMonth(), year: now.getFullYear() };

const toIndex = (p: Period) => p.year * 12 + p.month;
const fromIndex = (i: number): Period => ({
  year: Math.floor(i / 12),
  month: i % 12,
});
const shift = (p: Period, months: number) => fromIndex(toIndex(p) + months);

interface DashboardFiltersProps {
  from: Period;
  to: Period;
  onFromChange: (p: Period) => void;
  onToChange: (p: Period) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  min: Period;
  categories: Category[];
  selectedCategories: Set<string>;
  onCategoriesChange: (next: Set<string>) => void;
}

export function DashboardFilters({
  from,
  to,
  onFromChange,
  onToChange,
  groupBy,
  onGroupByChange,
  min,
  categories,
  selectedCategories,
  onCategoriesChange,
}: DashboardFiltersProps) {
  const apply = (f: Period, t: Period) => {
    onFromChange(f);
    onToChange(t);
  };

  const presets: { label: string; run: () => void }[] = [
    { label: '6 meses', run: () => apply(shift(CURRENT, -5), CURRENT) },
    { label: '12 meses', run: () => apply(shift(CURRENT, -11), CURRENT) },
    { label: '24 meses', run: () => apply(shift(CURRENT, -23), CURRENT) },
    {
      label: 'Este ano',
      run: () => apply({ month: 0, year: CURRENT.year }, CURRENT),
    },
    {
      label: 'Ano passado',
      run: () =>
        apply(
          { month: 0, year: CURRENT.year - 1 },
          { month: 11, year: CURRENT.year - 1 }
        ),
    },
    { label: 'Tudo', run: () => apply(min, CURRENT) },
  ];

  const years = Array.from(
    { length: CURRENT.year - min.year + 1 },
    (_, i) => min.year + i
  );

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <Card title="Período">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.run}
              className="rounded-lg border border-brand-moss/20 px-2 py-1 text-xs font-medium text-brand-gray transition hover:bg-brand-light hover:text-brand-moss"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <RangeRow label="De" value={from} years={years} onChange={onFromChange} />
          <RangeRow label="Até" value={to} years={years} onChange={onToChange} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-brand-light p-1">
          {(['month', 'year'] as GroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGroupByChange(g)}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                groupBy === g
                  ? 'bg-white text-brand-moss shadow-sm'
                  : 'text-brand-gray'
              }`}
            >
              {g === 'month' ? 'Por mês' : 'Por ano'}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Categorias">
        <CategoryFilter
          categories={categories}
          selected={selectedCategories}
          onChange={onCategoriesChange}
        />
      </Card>
    </aside>
  );
}

const selectClass =
  'rounded-lg border border-brand-moss/25 bg-white px-2 py-1.5 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

function RangeRow({
  label,
  value,
  years,
  onChange,
}: {
  label: string;
  value: Period;
  years: number[];
  onChange: (p: Period) => void;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2">
      <span className="text-xs font-medium text-brand-gray">{label}</span>
      <select
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        className={`${selectClass} capitalize`}
        aria-label={`${label} — mês`}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={i} className="capitalize">
            {name}
          </option>
        ))}
      </select>
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className={selectClass}
        aria-label={`${label} — ano`}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
        {title}
      </h2>
      {children}
    </div>
  );
}
