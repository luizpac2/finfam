import { useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';

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

const byName = (a: Category, b: Category) =>
  a.name.localeCompare(b.name, 'pt-BR');

/**
 * Lista de categorias em multisseleção para filtrar lançamentos. As
 * subcategorias ficam "sanfonadas" dentro da categoria-pai — só aparecem ao
 * expandir. Sem nada marcado, o filtro é "todas". Inclui "Sem categoria".
 */
export function CategoryFilter({
  categories,
  selected,
  onChange,
  loading = false,
}: CategoryFilterProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { roots, childrenOf } = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId).sort(byName);
    const childrenOf = (id: string) =>
      categories.filter((c) => c.parentId === id).sort(byName);
    return { roots, childrenOf };
  }, [categories]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const itemClass = (active: boolean) =>
    `flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
      active
        ? 'bg-brand-aqua/15 text-brand-moss'
        : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
    }`;

  const swatch = (category: Category, size = 'h-5 w-5') => (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-md`}
      style={{ backgroundColor: `${category.color ?? '#D8D8D8'}33` }}
    >
      <CategoryIcon name={category.icon} className="h-3 w-3" />
    </span>
  );

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

      <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="px-2 py-2 text-xs text-brand-gray">Carregando…</p>
        ) : (
          <>
            {roots.map((root) => {
              const children = childrenOf(root.id);
              const isOpen = expanded.has(root.id);
              return (
                <div key={root.id}>
                  <div className="flex items-center">
                    {children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(root.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-gray transition hover:text-brand-moss"
                        aria-label={isOpen ? 'Recolher' : 'Expandir'}
                        aria-expanded={isOpen}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="h-6 w-6 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(root.id)}
                      className={itemClass(selected.has(root.id))}
                    >
                      {swatch(root)}
                      <span className="flex-1 truncate">{root.name}</span>
                      {selected.has(root.id) && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />
                      )}
                    </button>
                  </div>

                  {isOpen &&
                    children.map((child) => (
                      <div key={child.id} className="flex items-center">
                        <span className="h-6 w-6 shrink-0" />
                        <button
                          type="button"
                          onClick={() => toggle(child.id)}
                          className={itemClass(selected.has(child.id))}
                        >
                          {swatch(child, 'h-4 w-4')}
                          <span className="flex-1 truncate">{child.name}</span>
                          {selected.has(child.id) && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />
                          )}
                        </button>
                      </div>
                    ))}
                </div>
              );
            })}

            <div className="flex items-center">
              <span className="h-6 w-6 shrink-0" />
              <button
                type="button"
                onClick={() => toggle(UNCATEGORIZED)}
                className={itemClass(selected.has(UNCATEGORIZED))}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gray/15 text-brand-gray">
                  —
                </span>
                <span className="flex-1 truncate italic">Sem categoria</span>
                {selected.has(UNCATEGORIZED) && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
