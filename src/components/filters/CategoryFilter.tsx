import { useMemo, useState } from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';

import type { Category } from '../../domain/entities/Category';
import { normalizeText } from '../../domain/categorizationEngine';
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
  const [query, setQuery] = useState('');

  const { roots, childrenOf } = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId).sort(byName);
    const childrenOf = (id: string) =>
      categories.filter((c) => c.parentId === id).sort(byName);
    return { roots, childrenOf };
  }, [categories]);

  const q = normalizeText(query);

  // Estrutura a exibir: com busca, mostra raízes/filhas que casam (já abertas);
  // sem busca, respeita a sanfona.
  const display = useMemo(() => {
    if (!q) {
      return roots.map((root) => ({
        root,
        children: childrenOf(root.id),
        open: expanded.has(root.id),
        toggleable: true,
      }));
    }
    const out: {
      root: Category;
      children: Category[];
      open: boolean;
      toggleable: boolean;
    }[] = [];
    for (const root of roots) {
      const kids = childrenOf(root.id);
      const rootMatch = normalizeText(root.name).includes(q);
      const kidMatch = kids.filter((k) => normalizeText(k.name).includes(q));
      if (rootMatch || kidMatch.length > 0) {
        out.push({
          root,
          children: rootMatch ? kids : kidMatch,
          open: true,
          toggleable: false,
        });
      }
    }
    return out;
  }, [roots, childrenOf, q, expanded]);

  const showNone = !q || 'sem categoria'.includes(q);

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

      {/* Busca */}
      <div className="relative mb-1.5">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gray" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar categoria…"
          className="w-full rounded-lg border border-brand-moss/20 bg-white py-1.5 pl-8 pr-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
        />
      </div>

      <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="px-2 py-2 text-xs text-brand-gray">Carregando…</p>
        ) : display.length === 0 && !showNone ? (
          <p className="px-2 py-2 text-xs text-brand-gray">Nada encontrado.</p>
        ) : (
          <>
            {display.map(({ root, children, open, toggleable }) => (
              <div key={root.id}>
                <div className="flex items-center">
                  {toggleable && children.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(root.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-gray transition hover:text-brand-moss"
                      aria-label={open ? 'Recolher' : 'Expandir'}
                      aria-expanded={open}
                    >
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          open ? 'rotate-90' : ''
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

                {open &&
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
            ))}

            {showNone && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
