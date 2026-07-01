import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Period {
  /** Mês 0–11. */
  month: number;
  year: number;
}

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
  /** Impede navegar além deste mês (padrão: mês atual). */
  max?: Period;
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2020, i, 1))
);

const now = new Date();
const CURRENT: Period = { month: now.getMonth(), year: now.getFullYear() };
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT.year - i);

const toIndex = (p: Period) => p.year * 12 + p.month;
const fromIndex = (index: number): Period => ({
  year: Math.floor(index / 12),
  month: index % 12,
});

/**
 * Filtro global de mês/ano do Dashboard. Permite navegar por setas ou escolher
 * diretamente nos seletores. Não avança além do mês máximo (padrão: atual).
 */
export function PeriodFilter({
  value,
  onChange,
  max = CURRENT,
}: PeriodFilterProps) {
  const atMax = toIndex(value) >= toIndex(max);

  const shift = (delta: number) => {
    const next = fromIndex(toIndex(value) + delta);
    if (toIndex(next) > toIndex(max)) return;
    onChange(next);
  };

  const selectClass =
    'rounded-lg border border-brand-moss/25 bg-white px-2.5 py-1.5 text-sm font-medium text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';
  const arrowClass =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-moss/20 text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        className={arrowClass}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <select
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
          className={`${selectClass} capitalize`}
          aria-label="Mês"
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={index} value={index} className="capitalize">
              {name}
            </option>
          ))}
        </select>

        <select
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className={selectClass}
          aria-label="Ano"
        >
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => shift(1)}
        disabled={atMax}
        className={arrowClass}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
