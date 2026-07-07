import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { categoryService, transactionService } from '../services';
import type { Category } from '../domain/entities/Category';
import { Card } from '../components/ui/Card';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { IconPicker } from '../components/ui/IconPicker';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatDate } from '../lib/format';

const DEFAULT_COLOR = '#6D7368';
const MAX_MONTHS = 24;

const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = () => new Date().toISOString().slice(0, 10);
const currentYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const monthShort = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});
const ymLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return monthShort.format(new Date(y, m - 1, 1)).replace('.', '');
};

/** Enumera os meses (YYYY-MM) de `start` até `end`, inclusive. */
const monthsBetween = (start: string, end: string): string[] => {
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

type Coverage = 'uploaded' | 'missing' | 'na';

/**
 * Controle de cartões de crédito: declara os cartões vigentes (e quando foram
 * cancelados) e mostra, por mês, se a fatura de cada cartão já foi importada.
 */
export default function CardsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { categories, loadingCategories, refreshCategories } =
    useReferenceData();

  const [cardMonths, setCardMonths] = useState<Set<string>>(new Set());
  const [loadingCoverage, setLoadingCoverage] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState('credit-card');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    transactionService
      .cardMonths()
      .then(setCardMonths)
      .finally(() => setLoadingCoverage(false));
  }, []);

  const cards = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'credit_card')
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [categories]
  );

  // Primeiro mês com dados de cada cartão (início do período "esperado").
  const cardFirstMonth = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of cardMonths) {
      const [cardId, ym] = key.split('|');
      const cur = map.get(cardId);
      if (!cur || ym < cur) map.set(cardId, ym);
    }
    return map;
  }, [cardMonths]);

  // Colunas de mês (do 1º mês com dados de cartão até o mês atual; teto MAX_MONTHS).
  const months = useMemo(() => {
    const now = currentYm();
    const firsts = [...cardFirstMonth.values()].sort();
    let start = firsts[0] ?? now;
    const all = monthsBetween(start, now);
    if (all.length > MAX_MONTHS) start = all[all.length - MAX_MONTHS];
    return monthsBetween(start, now);
  }, [cardFirstMonth]);

  const now = currentYm();

  const coverage = (card: Category, ym: string): Coverage => {
    if (cardMonths.has(`${card.id}|${ym}`)) return 'uploaded';
    const closedYm = card.closedAt ? card.closedAt.slice(0, 7) : null;
    if (closedYm && ym > closedYm) return 'na'; // após o cancelamento
    const first = cardFirstMonth.get(card.id);
    if (!first || ym < first) return 'na'; // sem histórico / antes do 1º uso
    return 'missing';
  };

  // Status do mês atual (só cartões vigentes).
  const activeCards = cards.filter((c) => !c.closedAt);
  const missingThisMonth = activeCards.filter(
    (c) => coverage(c, now) === 'missing'
  );

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await categoryService.create({
        name: name.trim(),
        kind: 'credit_card',
        color,
        icon,
      });
      setName('');
      setColor(DEFAULT_COLOR);
      setIcon('credit-card');
      await refreshCategories();
      toast.success('Cartão adicionado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar.');
    } finally {
      setSaving(false);
    }
  };

  const patchCard = async (
    card: Category,
    closedAt: string | null,
    message: string
  ) => {
    setBusyId(card.id);
    try {
      await categoryService.update(card.id, { closedAt });
      await refreshCategories();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar.');
    } finally {
      setBusyId(null);
    }
  };

  const removeCard = async (card: Category) => {
    if (
      !window.confirm(
        `Excluir o cartão "${card.name}"? Os lançamentos ligados a ele ficam sem cartão (não são apagados).`
      )
    )
      return;
    setBusyId(card.id);
    try {
      await categoryService.remove(card.id);
      await refreshCategories();
      toast.success('Cartão excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  if (loadingCategories) return <FullScreenLoader label="Carregando cartões…" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Cartões de crédito
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Declare os cartões vigentes e acompanhe, por mês, se a fatura de cada
          um já foi importada.
        </p>
      </header>

      {/* Status do mês atual */}
      {activeCards.length > 0 && (
        <Card
          className={
            missingThisMonth.length > 0
              ? 'border-brand-expense/30 bg-brand-expense/5'
              : 'border-brand-income/30 bg-brand-income/5'
          }
        >
          <p className="text-sm font-semibold text-brand-moss">
            Faturas de {ymLabel(now)}
          </p>
          {missingThisMonth.length === 0 ? (
            <p className="mt-1 text-sm text-brand-income">
              Tudo em dia — todas as faturas dos cartões vigentes foram
              importadas. ✓
            </p>
          ) : (
            <p className="mt-1 text-sm text-brand-expense">
              Faltando importar:{' '}
              <strong>
                {missingThisMonth.map((c) => c.name).join(', ')}
              </strong>
              .
            </p>
          )}
        </Card>
      )}

      {/* Gestão dos cartões */}
      {isAdmin && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-brand-moss">
            Adicionar cartão
          </h2>
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Nubank, Itaú…"
              className="min-w-0 flex-1 rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
            />
            <IconPicker value={icon} color={color} onChange={setIcon} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[38px] w-11 cursor-pointer rounded-lg border border-brand-moss/25 bg-white p-1"
              aria-label="Cor"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </button>
          </form>
        </Card>
      )}

      {cards.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-brand-gray">
            Nenhum cartão cadastrado ainda.
            {isAdmin ? ' Adicione o primeiro acima.' : ''}
          </p>
        </Card>
      ) : (
        <>
          {/* Lista de cartões com status */}
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-brand-moss/10">
              {cards.map((card) => {
                const busy = busyId === card.id;
                return (
                  <li
                    key={card.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${card.color ?? '#D8D8D8'}33` }}
                      >
                        <CategoryIcon name={card.icon} className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-brand-moss">
                        {card.name}
                      </span>
                      {card.closedAt ? (
                        <span className="rounded-full bg-brand-gray/20 px-2 py-0.5 text-xs text-brand-gray">
                          Cancelado em {formatDate(card.closedAt)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-income/15 px-2 py-0.5 text-xs font-medium text-brand-income">
                          Vigente
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap items-center gap-2">
                        {card.closedAt ? (
                          <>
                            <input
                              type="date"
                              value={card.closedAt}
                              disabled={busy}
                              onChange={(e) =>
                                patchCard(
                                  card,
                                  e.target.value || todayIso(),
                                  'Data atualizada.'
                                )
                              }
                              className="rounded-lg border border-brand-moss/25 bg-white px-2 py-1 text-sm text-brand-moss outline-none focus:border-brand-aqua"
                              aria-label="Data de cancelamento"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                patchCard(card, null, 'Cartão reativado.')
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-brand-moss/25 px-3 py-1.5 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
                            >
                              <Check className="h-4 w-4" />
                              Reativar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              patchCard(
                                card,
                                todayIso(),
                                `"${card.name}" marcado como cancelado.`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-moss/25 px-3 py-1.5 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeCard(card)}
                          className="rounded-lg p-1.5 text-brand-gray transition hover:text-red-600 disabled:opacity-60"
                          aria-label={`Excluir ${card.name}`}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Matriz cartão × mês */}
          <div>
            <h2 className="mb-2 text-base font-semibold text-brand-moss">
              Faturas por mês
            </h2>
            <Card className="overflow-x-auto p-0">
              {loadingCoverage ? (
                <p className="px-4 py-8 text-center text-sm text-brand-gray">
                  Carregando cobertura…
                </p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-brand-moss/10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
                      <th className="sticky left-0 z-10 bg-brand-light px-4 py-2 text-left font-medium">
                        Cartão
                      </th>
                      {months.map((ym) => (
                        <th
                          key={ym}
                          className={`px-2 py-2 text-center font-medium capitalize ${
                            ym === now ? 'text-brand-moss' : ''
                          }`}
                        >
                          {ymLabel(ym)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-moss/10">
                    {cards.map((card) => (
                      <tr key={card.id} className="hover:bg-brand-light/40">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2 font-medium text-brand-moss">
                          <span className="flex items-center gap-2">
                            <CategoryIcon name={card.icon} className="h-3.5 w-3.5" />
                            {card.name}
                          </span>
                        </td>
                        {months.map((ym) => {
                          const cov = coverage(card, ym);
                          return (
                            <td key={ym} className="px-2 py-2 text-center">
                              {cov === 'uploaded' ? (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-income/15 text-brand-income"
                                  title="Fatura importada"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : cov === 'missing' ? (
                                <span
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-expense/15 text-brand-expense"
                                  title="Fatura faltando"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span
                                  className="text-brand-gray/40"
                                  title="Fora do período do cartão"
                                >
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-gray">
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-brand-income" /> fatura
                importada
              </span>
              <span className="inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5 text-brand-expense" /> faltando
              </span>
              <span className="inline-flex items-center gap-1">
                — fora do período (antes do 1º uso ou após o cancelamento)
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
