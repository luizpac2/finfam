import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CreditCard, Check, Layers, Search } from 'lucide-react';

import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import type { Transaction } from '../domain/entities/Transaction';
import { normalizeText } from '../domain/categorizationEngine';
import {
  groupInstallments,
  installmentSchedule,
  type InstallmentGroup,
} from '../domain/installments';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrency } from '../lib/format';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

const MONTH_FMT = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

/** Rótulo curto de mês/ano a partir de uma data ISO (ex.: "Jul/25"). */
const monthLabel = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const s = MONTH_FMT.format(new Date(y, m - 1, d || 1)).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Situacao = 'all' | 'ongoing' | 'done';
type SortBy = 'remaining' | 'total' | 'progress' | 'alpha';

const SITUACAO: { id: Situacao; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'ongoing', label: 'Em andamento' },
  { id: 'done', label: 'Quitadas' },
];

const SORTS: { id: SortBy; label: string }[] = [
  { id: 'remaining', label: 'Falta pagar' },
  { id: 'total', label: 'Valor total' },
  { id: 'progress', label: 'Progresso' },
  { id: 'alpha', label: 'Alfabética' },
];

const NO_CARD = '__none__';

/** Dados derivados de um grupo de parcelas, prontos para filtrar/exibir. */
interface Purchase {
  group: InstallmentGroup<Transaction>;
  cardId: string | null;
  done: boolean;
  remaining: number; // parcelas que faltam
  remainingValue: number;
  totalValue: number;
}

/**
 * Parcelamentos: identifica compras parceladas (a parcela vem na descrição do
 * extrato, ex.: "3/10") e mostra todas agrupadas por compra, com coluna de
 * filtros inteligentes (busca, situação, cartão, ordenação).
 */
export default function InstallmentsPage() {
  const toast = useToast();
  const { categories } = useReferenceData();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('all');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('remaining');

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

  const cards = useMemo(
    () => categories.filter((c) => c.kind === 'credit_card'),
    [categories]
  );
  const cardById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cards) map.set(c.id, c.name);
    return map;
  }, [cards]);

  // Todas as compras parceladas (com dados derivados).
  const purchases = useMemo<Purchase[]>(() => {
    return groupInstallments(transactions).map((group) => {
      const remaining = Math.max(group.total - group.lastCurrent, 0);
      return {
        group,
        cardId: group.items[0]?.cardId ?? null,
        done: remaining === 0,
        remaining,
        remainingValue: group.amount * remaining,
        totalValue: group.amount * group.total,
      };
    });
  }, [transactions]);

  // Quais cartões realmente aparecem em parcelamentos (para o filtro).
  const cardsInUse = useMemo(() => {
    const ids = new Set<string>();
    let hasNoCard = false;
    for (const p of purchases) {
      if (p.cardId) ids.add(p.cardId);
      else hasNoCard = true;
    }
    return { ids, hasNoCard };
  }, [purchases]);

  const visible = useMemo(() => {
    const q = normalizeText(query);
    const list = purchases.filter((p) => {
      if (situacao === 'ongoing' && p.done) return false;
      if (situacao === 'done' && !p.done) return false;
      if (selectedCards.size > 0) {
        const key = p.cardId ?? NO_CARD;
        if (!selectedCards.has(key)) return false;
      }
      if (q && !normalizeText(p.group.label).includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return b.totalValue - a.totalValue;
        case 'progress':
          return (
            b.group.lastCurrent / b.group.total -
            a.group.lastCurrent / a.group.total
          );
        case 'alpha':
          return a.group.label.localeCompare(b.group.label, 'pt-BR');
        case 'remaining':
        default:
          return b.remainingValue - a.remainingValue;
      }
    });
    return sorted;
  }, [purchases, query, situacao, selectedCards, sortBy]);

  // KPIs refletem o conjunto FILTRADO.
  const totals = useMemo(() => {
    let value = 0;
    let remaining = 0;
    let perMonth = 0;
    for (const p of visible) {
      value += p.totalValue;
      remaining += p.remainingValue;
      if (!p.done) perMonth += p.group.amount;
    }
    return { count: visible.length, value, remaining, perMonth };
  }, [visible]);

  const toggleCard = (id: string) =>
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <FullScreenLoader label="Carregando parcelamentos…" />;

  const hasAny = purchases.length > 0;

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

      {!hasAny ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
          {/* Coluna de filtros inteligentes */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <FilterCard title="Busca">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar compra…"
                  className="w-full rounded-lg border border-brand-moss/20 bg-white py-2 pl-9 pr-3 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
                />
              </div>
            </FilterCard>

            <FilterCard title="Situação">
              <div className="flex rounded-lg bg-brand-light p-0.5">
                {SITUACAO.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSituacao(s.id)}
                    className={`flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition ${
                      situacao === s.id
                        ? 'bg-white text-brand-moss shadow-sm'
                        : 'text-brand-gray hover:text-brand-moss'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </FilterCard>

            {(cardsInUse.ids.size > 0 || cardsInUse.hasNoCard) && (
              <FilterCard title="Cartão">
                <button
                  type="button"
                  onClick={() => setSelectedCards(new Set())}
                  className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
                    selectedCards.size === 0
                      ? 'bg-brand-aqua/15 text-brand-moss'
                      : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
                  }`}
                >
                  Todos os cartões
                </button>
                <div className="space-y-0.5">
                  {cards
                    .filter((c) => cardsInUse.ids.has(c.id))
                    .map((c) => (
                      <CardOption
                        key={c.id}
                        label={c.name}
                        color={c.color}
                        icon={c.icon}
                        active={selectedCards.has(c.id)}
                        onClick={() => toggleCard(c.id)}
                      />
                    ))}
                  {cardsInUse.hasNoCard && (
                    <CardOption
                      label="Sem cartão"
                      active={selectedCards.has(NO_CARD)}
                      onClick={() => toggleCard(NO_CARD)}
                      italic
                    />
                  )}
                </div>
              </FilterCard>
            )}

            <FilterCard title="Ordenar por">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FilterCard>
          </aside>

          {/* Conteúdo */}
          <div className="min-w-0 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Compras" value={String(totals.count)} />
              <Kpi label="Valor total" value={formatCurrency(totals.value)} />
              <Kpi
                label="Falta pagar"
                value={formatCurrency(totals.remaining)}
                tone="expense"
              />
              <Kpi
                label="Por mês (em aberto)"
                value={formatCurrency(totals.perMonth)}
              />
            </section>

            {visible.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-brand-moss/20 bg-white px-6 py-12 text-center text-sm text-brand-gray">
                Nenhuma compra parcelada com esses filtros.
              </p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {visible.map((p) => (
                  <PurchaseCard
                    key={p.group.key}
                    purchase={p}
                    cardName={p.cardId ? cardById.get(p.cardId) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PurchaseCard({
  purchase,
  cardName,
}: {
  purchase: Purchase;
  cardName?: string;
}) {
  const { group, done, remaining } = purchase;
  const pct = Math.round((group.lastCurrent / group.total) * 100);
  const category = group.items.find((t) => t.category)?.category;

  const schedule = useMemo(
    () => installmentSchedule(group.items, group.total, group.lastCurrent),
    [group]
  );
  const next = schedule.find((e) => !e.paid);

  return (
    <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
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
            <div className="mt-0.5 flex items-center gap-2 text-xs text-brand-gray">
              {cardName && (
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="h-3 w-3" strokeWidth={1.8} />
                  {cardName}
                </span>
              )}
              {category && <span className="truncate">{category.name}</span>}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            done
              ? 'bg-brand-income/15 text-brand-income'
              : 'bg-violet-100 text-violet-700'
          }`}
        >
          {done ? 'Quitada' : `${group.lastCurrent}/${group.total}`}
        </span>
      </div>

      {/* Progresso */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-light">
          <div
            className={`h-full rounded-full ${done ? 'bg-brand-income' : 'bg-brand-aqua'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {next && (
          <span className="shrink-0 text-xs text-brand-gray">
            Próxima <strong className="text-brand-moss">{monthLabel(next.date)}</strong>
          </span>
        )}
      </div>

      {/* Números */}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Cell label="Parcela" value={formatCurrency(group.amount)} />
        <Cell label="Total" value={formatCurrency(purchase.totalValue)} />
        <Cell
          label={remaining > 0 ? `Falta (${remaining}x)` : 'Quitado'}
          value={remaining > 0 ? formatCurrency(purchase.remainingValue) : '—'}
          tone={remaining > 0 ? 'expense' : 'muted'}
        />
      </dl>

      {/* Cronograma de cobrança (datas estimadas por parcela) */}
      <details className="mt-3 border-t border-brand-moss/10 pt-2">
        <summary className="cursor-pointer text-xs font-medium text-brand-gray transition hover:text-brand-moss">
          Cronograma das {group.total} parcelas
        </summary>
        <ul className="mt-2 space-y-0.5">
          {schedule.map((e) => (
            <li
              key={e.current}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                e.paid ? 'text-brand-gray' : 'bg-brand-light/50 text-brand-moss'
              }`}
            >
              <span className="w-10 shrink-0 tabular-nums">
                {e.current}/{group.total}
              </span>
              <span className="w-16 shrink-0 tabular-nums">
                {monthLabel(e.date)}
              </span>
              <span className="flex-1 text-right font-medium">
                {formatCurrency(group.amount)}
              </span>
              <span
                className={`w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide ${
                  e.paid ? 'text-brand-gray/70' : 'text-brand-aqua'
                }`}
              >
                {e.paid ? 'Lançada' : 'Prevista'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function CardOption({
  label,
  color,
  icon,
  active,
  onClick,
  italic = false,
}: {
  label: string;
  color?: string | null;
  icon?: string | null;
  active: boolean;
  onClick: () => void;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
        active
          ? 'bg-brand-aqua/15 text-brand-moss'
          : 'text-brand-gray hover:bg-brand-light hover:text-brand-moss'
      }`}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color ?? '#D8D8D8'}33` }}
      >
        {icon !== undefined ? (
          <CategoryIcon name={icon} className="h-3 w-3" />
        ) : (
          <CreditCard className="h-3 w-3" strokeWidth={1.8} />
        )}
      </span>
      <span className={`flex-1 truncate ${italic ? 'italic' : ''}`}>{label}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-moss" />}
    </button>
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

function EmptyState() {
  return (
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
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
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
