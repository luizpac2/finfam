import { Check } from 'lucide-react';

import type { Category } from '../../domain/entities/Category';
import { CategoryIcon } from '../../lib/categoryIcons';

/** Sentinela para filtrar lançamentos sem categoria. */
export const UNCATEGORIZED = '__none__';

interface CategoryFilterProps {
  categories: Category[];
  /** Ids selecionados (vazio = todas). Pode conter {@link UNCATEGORIZED}. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  loading?: boolean;
}

/**
 * Lista de categorias em multisseleção para filtrar lançamentos. Sem nenhuma
 * marcada, o filtro é "todas". Inclui a opção "Sem categoria".
 */
export function CategoryFilter({
  categories,
  selected,
  onChange,
  loading = false,
}: CategoryFilterProps) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const rowClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
      active
        ? 'bg-brand-aqua/15 text-brand-moss'
        : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
    }`;

  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
          selected.size === 0
            ? 'bg-brand-aqua/15 text-brand-moss'
            : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
        }`}
      >
        Todas as categorias
      </button>

      <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="px-2 py-2 text-xs text-brand-gray">Carregando…</p>
        ) : (
          <>
            {categories.map((category) => {
              const active = selected.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggle(category.id)}
                  className={rowClass(active)}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${category.color ?? '#D8D8D8'}33` }}
                  >
                    <CategoryIcon name={category.icon} className="h-3 w-3" />
                  </span>
                  <span className="flex-1 truncate">{category.name}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => toggle(UNCATEGORIZED)}
              className={rowClass(selected.has(UNCATEGORIZED))}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gray/15 text-brand-gray">
                —
              </span>
              <span className="flex-1 truncate italic">Sem categoria</span>
              {selected.has(UNCATEGORIZED) && (
                <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
