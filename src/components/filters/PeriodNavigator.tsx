import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Period {
  /** Mês 0–11. */
  month: number;
  year: number;
}

/** Abreviações de mês localizadas (jan, fev, …) já capitalizadas. */
const MONTH_ABBR = Array.from({ length: 12 }, (_, i) => {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(2020, i, 1))
    .replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
});

const now = new Date();
const CURRENT: Period = { month: now.getMonth(), year: now.getFullYear() };

const toIndex = (p: Period) => p.year * 12 + p.month;

interface PeriodNavigatorProps {
  value: Period;
  onChange: (period: Period) => void;
  /** Impede navegar além deste mês (padrão: mês atual). */
  max?: Period;
}

/**
 * Navegação compacta de período: passo de ano (‹ 2026 ›) + grade dos 12 meses.
 * Meses futuros ficam desabilitados; ao trocar de ano, o mês selecionado é
 * limitado ao máximo permitido.
 */
export function PeriodNavigator({
  value,
  onChange,
  max = CURRENT,
}: PeriodNavigatorProps) {
  const maxIndex = toIndex(max);
  const atMaxYear = value.year >= max.year;

  const setYear = (year: number) => {
    const next: Period = { year, month: value.month };
    onChange(toIndex(next) > maxIndex ? max : next);
  };

  const yearBtn =
    'flex h-7 w-7 items-center justify-center rounded-lg border border-brand-moss/20 text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div>
      {/* Passo de ano */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYear(value.year - 1)}
          className={yearBtn}
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-brand-moss">{value.year}</span>
        <button
          type="button"
          onClick={() => setYear(value.year + 1)}
          disabled={atMaxYear}
          className={yearBtn}
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grade de meses */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {MONTH_ABBR.map((name, index) => {
          const disabled = value.year * 12 + index > maxIndex;
          const active = value.month === index;
          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ year: value.year, month: index })}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                  ? 'bg-brand-aqua text-brand-moss shadow-sm'
                  : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
