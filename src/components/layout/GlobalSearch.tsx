import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';

import { transactionService } from '../../services';
import { useReferenceData } from '../../hooks/useReferenceData';
import type { Transaction } from '../../domain/entities/Transaction';
import { categorySlug } from '../../domain/entities/Category';
import { normalizeText } from '../../domain/categorizationEngine';
import { CategoryKindLabel } from '../../domain/constants';
import { CategoryIcon } from '../../lib/categoryIcons';
import { formatCurrencyAccounting, formatDate } from '../../lib/format';

/**
 * Busca global (topo): encontra CATEGORIAS (pelo nome) e LANÇAMENTOS (por
 * descrição/valor). Categorias abrem a lista de lançamentos daquela categoria;
 * lançamentos abrem o editor.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { categories } = useReferenceData();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = term.trim();

  // Categorias que casam (cliente, cache) — instantâneo.
  const matchingCats = useMemo(() => {
    if (q.length < 2) return [];
    const n = normalizeText(q);
    return categories
      .filter((c) => normalizeText(c.name).includes(n))
      .slice(0, 5);
  }, [q, categories]);

  // Lançamentos (servidor) com debounce.
  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        setResults(await transactionService.search(q));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const close = () => {
    setOpen(false);
    setTerm('');
    setResults([]);
  };
  const openTx = (id: string) => {
    close();
    navigate(`/transacoes?tx=${id}`);
  };
  const openCat = (name: string) => {
    close();
    navigate(`/categoria/${categorySlug(name)}`);
  };

  const showPanel = open && q.length >= 2;
  const nothing = !loading && matchingCats.length === 0 && results.length === 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Buscar categorias e lançamentos…"
          className="w-full rounded-xl border border-brand-moss/20 bg-white py-2 pl-9 pr-8 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
          aria-label="Buscar"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              setResults([]);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-gray transition hover:text-brand-moss"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-xl border border-brand-moss/15 bg-white p-1 shadow-card">
          {matchingCats.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                Categorias
              </p>
              {matchingCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCat(c.name)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-brand-light"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${c.color ?? '#D8D8D8'}33` }}
                  >
                    <CategoryIcon name={c.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-moss">
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs text-brand-gray">
                    {CategoryKindLabel[c.kind]}
                  </span>
                </button>
              ))}
            </>
          )}

          {(loading || results.length > 0 || matchingCats.length === 0) && (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
              Lançamentos
            </p>
          )}
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-brand-gray">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando…
            </div>
          ) : nothing ? (
            <p className="px-3 py-3 text-sm text-brand-gray">
              Nada encontrado.
            </p>
          ) : (
            results.map((tx) => {
              const signed = tx.type === 'income' ? tx.amount : -tx.amount;
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => openTx(tx.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-brand-light"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${tx.category?.color ?? '#D8D8D8'}33`,
                    }}
                  >
                    <CategoryIcon name={tx.category?.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-moss">
                      {tx.description}
                    </p>
                    <p className="truncate text-xs text-brand-gray">
                      {formatDate(tx.date)} ·{' '}
                      {tx.category?.name ?? 'Sem categoria'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      tx.type === 'income'
                        ? 'text-brand-income'
                        : 'text-brand-expense'
                    }`}
                  >
                    {formatCurrencyAccounting(signed)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
