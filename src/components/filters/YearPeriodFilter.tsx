import { FilterCard } from './FilterCard';

interface YearPeriodFilterProps {
  /** Anos que possuem lançamentos (ordem indiferente). */
  availableYears: number[];
  /** Anos selecionados (vazio = nenhum). */
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}

/**
 * Filtro de período por **ano**: escolha um ou vários anos ao mesmo tempo, ou
 * "todo o período". Compartilhado pela Visão geral e pelo Dashboard, para as
 * duas páginas terem exatamente o mesmo filtro.
 */
export function YearPeriodFilter({
  availableYears,
  selected,
  onChange,
}: YearPeriodFilterProps) {
  const isAll =
    availableYears.length > 0 && selected.size === availableYears.length;

  const toggle = (year: number) => {
    const next = new Set(selected);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    onChange(next);
  };

  return (
    <FilterCard title="Período">
      <button
        type="button"
        onClick={() => onChange(new Set(availableYears))}
        className={`mb-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
          isAll
            ? 'bg-brand-aqua/15 text-brand-moss'
            : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
        }`}
      >
        Todo o período
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        {[...availableYears]
          .sort((a, b) => b - a)
          .map((year) => {
            const active = selected.has(year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => toggle(year)}
                aria-pressed={active}
                className={`rounded-lg border px-2 py-1.5 text-sm font-medium tabular-nums transition ${
                  active
                    ? 'border-brand-aqua bg-brand-aqua/15 text-brand-moss'
                    : 'border-brand-moss/15 text-brand-gray hover:border-brand-aqua/40 hover:text-brand-moss'
                }`}
              >
                {year}
              </button>
            );
          })}
      </div>

      <p className="mt-2 text-xs text-brand-gray">Escolha um ou mais anos.</p>
    </FilterCard>
  );
}
