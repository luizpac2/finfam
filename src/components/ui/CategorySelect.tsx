import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

import {
  buildCategoryOptions,
  type Category,
} from '../../domain/entities/Category';
import type { CategoryKind } from '../../lib/database.types';
import { normalizeText } from '../../domain/categorizationEngine';
import { CategoryIcon } from '../../lib/categoryIcons';

const KIND_LABEL: Record<CategoryKind, string> = {
  income: 'Receitas',
  expense: 'Despesas',
  credit_card: 'Cartão de Crédito',
};
const DEFAULT_KINDS: CategoryKind[] = ['income', 'expense', 'credit_card'];

interface EmptyOption {
  value: string;
  label: string;
}

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
  /** Quais tipos de categoria oferecer (e em que ordem). */
  kinds?: CategoryKind[];
  /** Opção especial no topo (ex.: "Sem categoria"). */
  emptyOption?: EmptyOption;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface Opt {
  value: string;
  label: string;
  category?: Category;
}

/**
 * Seletor de categoria com busca (combobox). Substitui o `<select>` simples —
 * digite para filtrar (ignora acentos/maiúsculas), navegue com as setas.
 * O painel é renderizado via portal para não ser cortado por contêineres com
 * overflow (ex.: a tabela de revisão da importação).
 */
export function CategorySelect({
  value,
  onChange,
  categories,
  kinds = DEFAULT_KINDS,
  emptyOption,
  placeholder = 'Selecione…',
  disabled = false,
  className = '',
  ariaLabel,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const groups = useMemo(
    () =>
      kinds
        .map((kind) => ({
          kind,
          label: KIND_LABEL[kind],
          options: buildCategoryOptions(categories, kind).map<Opt>((o) => ({
            value: o.id,
            label: o.label,
            category: categoryById.get(o.id),
          })),
        }))
        .filter((g) => g.options.length > 0),
    [kinds, categories, categoryById]
  );

  const q = normalizeText(query);
  const filteredGroups = useMemo(
    () =>
      (q
        ? groups
            .map((g) => ({
              ...g,
              options: g.options.filter((o) =>
                normalizeText(o.label).includes(q)
              ),
            }))
            .filter((g) => g.options.length > 0)
        : groups),
    [groups, q]
  );

  const showEmpty =
    emptyOption && (!q || normalizeText(emptyOption.label).includes(q));

  // Itens renderizáveis (cabeçalhos + opções) com índice plano para navegação.
  const items = useMemo(() => {
    const list: (
      | { t: 'header'; label: string }
      | { t: 'opt'; opt: Opt; i: number }
    )[] = [];
    let i = 0;
    if (showEmpty && emptyOption) {
      list.push({ t: 'opt', opt: { value: emptyOption.value, label: emptyOption.label }, i });
      i += 1;
    }
    for (const g of filteredGroups) {
      if (groups.length > 1) list.push({ t: 'header', label: g.label });
      for (const o of g.options) {
        list.push({ t: 'opt', opt: o, i });
        i += 1;
      }
    }
    return list;
  }, [filteredGroups, showEmpty, emptyOption, groups.length]);

  const flat = useMemo(
    () => items.filter((x): x is { t: 'opt'; opt: Opt; i: number } => x.t === 'opt').map((x) => x.opt),
    [items]
  );

  const selectedCategory = value ? categoryById.get(value) : undefined;
  const selectedLabel =
    emptyOption && value === emptyOption.value
      ? emptyOption.label
      : selectedCategory?.name;

  const updateRect = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    const reposition = () => updateRect();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setQuery('');
    setHighlight(0);
    setOpen(true);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = flat[highlight];
      if (opt) select(opt.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const swatch = (opt: Opt) =>
    opt.category ? (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${opt.category.color ?? '#D8D8D8'}33` }}
      >
        <CategoryIcon name={opt.category.icon} className="h-3 w-3" />
      </span>
    ) : (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-gray/15 text-[10px] text-brand-gray">
        —
      </span>
    );

  const triggerClass =
    'flex w-full items-center gap-2 rounded-lg border border-brand-moss/25 bg-white px-2.5 py-1.5 text-left text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={ariaLabel}
        className={`${triggerClass} ${className}`}
      >
        {selectedCategory && swatch({ value, label: '', category: selectedCategory })}
        <span className={`flex-1 truncate ${selectedLabel ? '' : 'text-brand-gray'}`}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-gray" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-50 rounded-xl border border-brand-moss/15 bg-white shadow-card"
            style={{
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 224),
            }}
          >
            <div className="relative border-b border-brand-moss/10 p-2">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Buscar categoria…"
                className="w-full rounded-lg border border-brand-moss/20 bg-white py-1.5 pl-9 pr-2 text-sm text-brand-moss outline-none focus:border-brand-aqua"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {flat.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-brand-gray">
                  Nada encontrado.
                </p>
              ) : (
                items.map((item, k) =>
                  item.t === 'header' ? (
                    <p
                      key={`h-${k}`}
                      className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-gray"
                    >
                      {item.label}
                    </p>
                  ) : (
                    <button
                      key={item.opt.value}
                      type="button"
                      onMouseEnter={() => setHighlight(item.i)}
                      onClick={() => select(item.opt.value)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        item.i === highlight ? 'bg-brand-light' : ''
                      } ${
                        item.opt.value === value
                          ? 'font-medium text-brand-moss'
                          : 'text-brand-gray'
                      }`}
                    >
                      {swatch(item.opt)}
                      <span className="flex-1 truncate">{item.opt.label}</span>
                      {item.opt.value === value && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />
                      )}
                    </button>
                  )
                )
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
