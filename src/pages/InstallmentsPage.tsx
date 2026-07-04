import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Layers, Search } from 'lucide-react';

import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import type { Transaction } from '../domain/entities/Transaction';
import { normalizeText } from '../domain/categorizationEngine';
import { groupInstallments } from '../domain/installments';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrency, formatDate } from '../lib/format';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

/**
 * Parcelamentos: identifica compras parceladas (a parcela vem na descrição do
 * extrato, ex.: "3/10") e mostra todas agrupadas, com o progresso e o que
 * ainda falta pagar. É a visão "uma compra com N parcelas".
 */
export default function InstallmentsPage() {
  const toast = useToast();
  const { categories } = useReferenceData();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    transactionService
      .list({})
      .then((list) => {
        if (active) setTransactions(list);
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Falha ao carregar os dados.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const cardById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories)
      if (c.kind === 'credit_card') map.set(c.id, c.name);
    return map;
  }, [categories]);

  const groups = useMemo(
    () => groupInstallments(transactions),
    [transactions]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return groups;
    return groups.filter((g) => normalizeText(g.label).includes(q));
  }, [groups, query]);

  const totals = useMemo(() => {
    let value = 0;
    let remaining = 0;
    let perMonth = 0;
    for (const g of groups) {
      value += g.amount * g.total;
      const left = Math.max(g.total - g.lastCurrent, 0);
      remaining += g.amount * left;
      if (left > 0) perMonth += g.amount;
    }
    return { count: groups.length, value, remaining, perMonth };
  }, [groups]);

  if (loading) return <FullScreenLoader label="Carregando parcelamentos…" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Parcelamentos
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Compras identificadas como parceladas (pela parcela na descrição, ex.:
          “3/10”), agrupadas por compra.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Compras parceladas" value={String(totals.count)} />
        <Kpi label="Valor total" value={formatCurrency(totals.value)} />
        <Kpi
          label="Falta pagar"
          value={formatCurrency(totals.remaining)}
          tone="expense"
        />
        <Kpi
          label="Por mês (em aberto)"
          value={formatCurrency(totals.perMonth)}
          hint="Soma das parcelas ainda em andamento"
        />
      </section>

      {/* Busca */}
      {groups.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar compra parcelada…"
            className="w-full rounded-lg border border-brand-moss/20 bg-white py-2 pl-9 pr-3 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
          />
        </div>
      )}

      {/* Lista */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-moss/20 bg-white px-6 py-16 text-center">
          <Layers className="mx-auto h-8 w-8 text-brand-gray/60" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-brand-moss">
            Nenhuma compra parcelada encontrada.
          </p>
          <p className="mt-1 text-sm text-brand-gray">
            Ao importar a fatura do cartão, as parcelas na descrição (ex.: “3/10”)
            são detectadas automaticamente.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-1 text-sm text-brand-gray">Nada encontrado.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((group) => {
            const cardName = group.items[0]?.cardId
              ? cardById.get(group.items[0].cardId!)
              : undefined;
            const remaining = Math.max(group.total - group.lastCurrent, 0);
            const pct = Math.round((group.lastCurrent / group.total) * 100);
            const category = group.items.find((t) => t.category)?.category;
            return (
              <div
                key={group.key}
                className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {category && (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${category.color ?? '#D8D8D8'}33` }}
                      >
                        <CategoryIcon name={category.icon} className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-moss">
                        {group.label}
                      </p>
                      {cardName && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-gray">
                          <CreditCard className="h-3 w-3" strokeWidth={1.8} />
                          {cardName}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    {group.lastCurrent}/{group.total}
                  </span>
                </div>

                {/* Progresso */}
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-light">
                    <div
                      className="h-full rounded-full bg-brand-aqua"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Números */}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Cell label="Parcela" value={formatCurrency(group.amount)} />
                  <Cell
                    label="Total"
                    value={formatCurrency(group.amount * group.total)}
                  />
                  <Cell
                    label={remaining > 0 ? `Falta (${remaining}x)` : 'Quitado'}
                    value={
                      remaining > 0
                        ? formatCurrency(group.amount * remaining)
                        : '—'
                    }
                    tone={remaining > 0 ? 'expense' : 'muted'}
                  />
                </dl>

                {/* Parcelas lançadas */}
                <details className="mt-3 border-t border-brand-moss/10 pt-2">
                  <summary className="cursor-pointer text-xs font-medium text-brand-gray transition hover:text-brand-moss">
                    {group.items.length} parcela(s) lançada(s)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {group.items.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-2 text-xs text-brand-gray"
                      >
                        <span className="tabular-nums">{formatDate(tx.date)}</span>
                        <span className="truncate">{tx.description}</span>
                        <span className="shrink-0 font-medium text-brand-expense">
                          {formatCurrency(tx.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'expense';
}) {
  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
      <p className="text-sm font-medium text-brand-gray">{label}</p>
      <p
        className={`mt-1 truncate text-xl font-bold tracking-tight ${
          tone === 'expense' ? 'text-brand-expense' : 'text-brand-moss'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-brand-gray">{hint}</p>}
    </div>
  );
}

function Cell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'expense' | 'muted';
}) {
  const color =
    tone === 'expense'
      ? 'text-brand-expense'
      : tone === 'muted'
        ? 'text-brand-gray'
        : 'text-brand-moss';
  return (
    <div className="rounded-lg bg-brand-light/60 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-brand-gray">
        {label}
      </dt>
      <dd className={`text-sm font-semibold ${color}`}>{value}</dd>
    </div>
  );
}
