import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import type { Transaction } from '../domain/entities/Transaction';
import type { Period } from '../components/filters/PeriodNavigator';
import { Card } from '../components/ui/Card';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrency, formatCurrencyAccounting, formatDate } from '../lib/format';

const PAGE_SIZE = 25;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
const CURRENT: Period = { month: now.getMonth(), year: now.getFullYear() };
const ALL_TIME: Period = { month: 0, year: 2000 };
const toIndex = (p: Period) => p.year * 12 + p.month;
const fromIndex = (i: number): Period => ({ year: Math.floor(i / 12), month: i % 12 });
const shift = (p: Period, months: number) => fromIndex(toIndex(p) + months);

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(2020, i, 1))
    .replace('.', '')
);

type TypeFilter = 'all' | 'income' | 'expense';

/** Lista paginada de TODOS os lançamentos de uma categoria, com filtros. */
export default function CategoryTransactionsPage() {
  const { categoryId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { categories } = useReferenceData();

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  // Ver uma categoria inclui as subcategorias; uma subcategoria mostra só ela.
  const categoryIds = useMemo(() => {
    const childIds = categories
      .filter((c) => c.parentId === categoryId)
      .map((c) => c.id);
    return [categoryId, ...childIds];
  }, [categories, categoryId]);
  const childCount = categoryIds.length - 1;

  const [from, setFrom] = useState<Period>(ALL_TIME);
  const [to, setTo] = useState<Period>(CURRENT);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  // Debounce da busca (reseta a página).
  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(h);
  }, [search]);

  const filters = useMemo(
    () => ({
      categoryIds,
      type: typeFilter === 'all' ? undefined : typeFilter,
      from: iso(new Date(from.year, from.month, 1)),
      to: iso(new Date(to.year, to.month + 1, 0)),
      search: debounced || undefined,
    }),
    [categoryIds, typeFilter, from, to, debounced]
  );

  // Totais do conjunto filtrado (consulta enxuta).
  useEffect(() => {
    let active = true;
    transactionService
      .filteredTotals(filters)
      .then((t) => active && setTotals(t))
      .catch(() => active && setTotals({ income: 0, expense: 0 }));
    return () => {
      active = false;
    };
  }, [filters]);

  // Página atual (server-side).
  useEffect(() => {
    let active = true;
    setLoading(true);
    transactionService
      .listPaged(filters, page, PAGE_SIZE)
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((err) => {
        if (active) {
          toast.error(err instanceof Error ? err.message : 'Falha ao carregar.');
          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, page, toast]);

  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const presets: { label: string; run: () => void }[] = [
    { label: 'Tudo', run: () => setFilter(() => { setFrom(ALL_TIME); setTo(CURRENT); }) },
    { label: '12 meses', run: () => setFilter(() => { setFrom(shift(CURRENT, -11)); setTo(CURRENT); }) },
    { label: 'Este ano', run: () => setFilter(() => { setFrom({ month: 0, year: CURRENT.year }); setTo(CURRENT); }) },
    { label: 'Ano passado', run: () => setFilter(() => { setFrom({ month: 0, year: CURRENT.year - 1 }); setTo({ month: 11, year: CURRENT.year - 1 }); }) },
  ];

  const years = Array.from({ length: CURRENT.year - 2000 + 1 }, (_, i) => 2000 + i).reverse();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          to="/categorias"
          className="rounded-lg p-1.5 text-brand-gray transition hover:bg-brand-light hover:text-brand-moss"
          aria-label="Voltar para Categorias"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${category?.color ?? '#D8D8D8'}33` }}
        >
          <CategoryIcon name={category?.icon} className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
            {category?.name ?? 'Categoria'}
          </h1>
          <p className="text-sm text-brand-gray">
            {childCount > 0
              ? `Todos os lançamentos — inclui ${childCount} subcategoria(s).`
              : 'Todos os lançamentos desta categoria.'}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* Filtros */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FilterCard title="Período">
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
              <RangeRow label="De" value={from} years={years} onChange={(p) => setFilter(() => setFrom(p))} />
              <RangeRow label="Até" value={to} years={years} onChange={(p) => setFilter(() => setTo(p))} />
            </div>
          </FilterCard>

          <FilterCard title="Tipo">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-brand-light p-1">
              {(
                [
                  ['all', 'Todos'],
                  ['income', 'Receitas'],
                  ['expense', 'Despesas'],
                ] as [TypeFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(() => setTypeFilter(value))}
                  className={`rounded-md px-1 py-1.5 text-sm font-medium transition ${
                    typeFilter === value
                      ? 'bg-white text-brand-moss shadow-sm'
                      : 'text-brand-gray'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterCard>

          <FilterCard title="Busca">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-gray" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Descrição ou valor…"
                className="w-full rounded-lg border border-brand-moss/20 bg-white py-1.5 pl-8 pr-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
              />
            </div>
          </FilterCard>
        </aside>

        {/* Lista */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-brand-gray">{total} lançamento(s)</span>
            <span className="font-medium text-brand-income">
              {formatCurrencyAccounting(totals.income)}
            </span>
            <span className="font-medium text-brand-expense">
              {formatCurrencyAccounting(-totals.expense)}
            </span>
          </div>

          <Card className="overflow-hidden p-0">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-brand-gray">Carregando…</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-brand-gray">
                Nenhum lançamento encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-brand-moss/10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Data</th>
                      <th className="px-4 py-2.5 font-medium">Descrição</th>
                      <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-moss/10">
                    {rows.map((tx) => {
                      const signed = tx.type === 'income' ? tx.amount : -tx.amount;
                      return (
                        <tr
                          key={tx.id}
                          onClick={() => navigate(`/transacoes?tx=${tx.id}`)}
                          className="cursor-pointer hover:bg-brand-light/50"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-brand-gray">
                            {formatDate(tx.date)}
                          </td>
                          <td className="max-w-[28rem] truncate px-4 py-2.5 font-medium text-brand-moss">
                            {tx.description}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${
                              tx.type === 'income'
                                ? 'text-brand-income'
                                : 'text-brand-expense'
                            }`}
                          >
                            {formatCurrency(signed)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Paginação */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-brand-gray">
                Página {page} de {pageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1 || loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-moss/20 text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
                  disabled={page >= pageCount || loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-moss/20 text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
        {title}
      </h2>
      {children}
    </div>
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
