import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Wand2 } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import { suggestCategoryIdStrict } from '../domain/categorizationEngine';
import { parseInstallment } from '../domain/installments';
import { applyUserRules, categoryKindMap } from '../domain/ruleEngine';
import {
  expandCategorySelection,
  type Category,
} from '../domain/entities/Category';
import type { Transaction } from '../domain/entities/Transaction';
import { FilterSidebar } from '../components/filters/FilterSidebar';
import { UNCATEGORIZED } from '../components/filters/CategoryFilter';
import type { Period } from '../components/filters/PeriodNavigator';
import {
  TransactionEditor,
  type TransactionFormValues,
} from '../components/transactions/TransactionEditor';
import { Card } from '../components/ui/Card';
import { CategorySelect } from '../components/ui/CategorySelect';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrencyAccounting, formatDate } from '../lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();

type TypeFilter = 'all' | 'income' | 'expense';

/** Página de gestão dos lançamentos já salvos: filtrar, editar, excluir e criar. */
export default function TransactionsPage() {
  const { profile } = useAuth();
  const toast = useToast();

  const [period, setPeriod] = useState<Period>({
    month: now.getMonth(),
    year: now.getFullYear(),
  });
  const { categories, rules, loadingCategories } = useReferenceData();
  const [monthsWithData, setMonthsWithData] = useState<Set<string>>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  // Seleção em massa.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const headerCbRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoCategorizing, setAutoCategorizing] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  // Abre o editor quando chega da busca global (?tx=<id>).
  useEffect(() => {
    const txId = searchParams.get('tx');
    if (!txId) return;
    let active = true;
    (async () => {
      try {
        const tx = await transactionService.getById(txId);
        if (active) {
          setEditing(tx);
          setEditorOpen(true);
        }
      } catch {
        if (active) toast.error('Lançamento não encontrado.');
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete('tx');
        setSearchParams(next, { replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams, toast]);

  // Meses com lançamentos (categorias/regras vêm do cache compartilhado).
  useEffect(() => {
    transactionService.monthsWithData().then(setMonthsWithData);
  }, []);

  const loadTransactions = useMemo(
    () => async (p: Period) => {
      setLoading(true);
      try {
        const from = isoDate(new Date(p.year, p.month, 1));
        const to = isoDate(new Date(p.year, p.month + 1, 0));
        setTransactions(await transactionService.list({ from, to }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao carregar.');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadTransactions(period);
  }, [period, loadTransactions]);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Selecionar uma categoria-pai inclui as subcategorias.
  const effectiveCats = useMemo(
    () => expandCategorySelection(selectedCats, categories),
    [selectedCats, categories]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (term && !tx.description.toLowerCase().includes(term)) return false;
      if (
        effectiveCats.size > 0 &&
        !effectiveCats.has(tx.categoryId ?? UNCATEGORIZED)
      )
        return false;
      return true;
    });
  }, [transactions, typeFilter, search, effectiveCats]);

  // Mantém a seleção coerente: descarta ids que saíram da lista visível.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const allSelected =
    filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, tx) => {
          // Pagamento de fatura (categoria cartão) não conta em receitas/despesas.
          if (tx.category?.kind === 'credit_card') return acc;
          if (tx.type === 'income') acc.income += tx.amount;
          else acc.expense += tx.amount;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [filtered]
  );

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filtered.every((t) => next.has(t.id))) {
        filtered.forEach((t) => next.delete(t.id));
      } else {
        filtered.forEach((t) => next.add(t.id));
      }
      return next;
    });

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (values: TransactionFormValues) => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload = {
        date: values.date,
        description: values.description,
        amount: values.amount,
        type: values.type,
        categoryId: values.categoryId || null,
        cardId: values.cardId || null,
        // Edição na mão: protege a categoria da aplicação de regras ao histórico.
        manualCategory: true,
      };
      if (editing) {
        await transactionService.update(editing.id, payload);
        toast.success('Lançamento atualizado.');
      } else {
        await transactionService.create({ ...payload, userId: profile.id });
        toast.success('Lançamento criado.');
      }
      closeEditor();
      await loadTransactions(period);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    if (!window.confirm(`Excluir "${tx.description}"?`)) return;
    try {
      await transactionService.remove(tx.id);
      toast.success('Lançamento excluído.');
      await loadTransactions(period);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    }
  };

  const applyBulkCategory = async () => {
    if (!bulkCategory) return;
    const ids = [...selectedIds];
    const categoryId = bulkCategory === UNCATEGORIZED ? null : bulkCategory;
    setApplyingBulk(true);
    try {
      // Edição em massa feita à mão → marca como manual (regras não sobrescrevem).
      await transactionService.setCategoryMany(ids, categoryId, true);
      toast.success(`Categoria alterada em ${ids.length} lançamento(s).`);
      setSelectedIds(new Set());
      setBulkCategory('');
      await loadTransactions(period);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar.');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleAutoCategorize = async () => {
    // Alvos: lançamentos sem categoria (ignora cancelados e pagamentos de
    // fatura, que já têm a categoria do cartão).
    const targets = transactions.filter(
      (tx) =>
        !tx.categoryId &&
        !tx.manualCategory &&
        tx.category?.kind !== 'credit_card'
    );

    // Agrupa por categoria: regra do usuário tem prioridade; senão a heurística
    // estrita (só match real; ambíguos ficam de fora).
    const kindById = categoryKindMap(categories);
    const groups = new Map<string, string[]>();
    for (const tx of targets) {
      const rule = applyUserRules(
        tx.description,
        tx.amount,
        tx.type,
        rules,
        kindById
      );
      const catId =
        rule.categoryId ??
        suggestCategoryIdStrict(tx.description, tx.type, categories);
      if (!catId) continue;
      const list = groups.get(catId) ?? [];
      list.push(tx.id);
      groups.set(catId, list);
    }

    const total = [...groups.values()].reduce((n, ids) => n + ids.length, 0);
    if (total === 0) {
      toast.info('Nenhum lançamento novo para categorizar neste período.');
      return;
    }

    setAutoCategorizing(true);
    try {
      for (const [catId, ids] of groups) {
        await transactionService.setCategoryMany(ids, catId);
      }
      toast.success(`${total} lançamento(s) categorizados automaticamente.`);
      await loadTransactions(period);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao categorizar.');
    } finally {
      setAutoCategorizing(false);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} lançamento(s) selecionado(s)?`))
      return;
    try {
      await transactionService.removeMany(ids);
      toast.success(`${ids.length} lançamento(s) excluídos.`);
      setSelectedIds(new Set());
      await loadTransactions(period);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Transações
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Edite ou exclua os lançamentos importados e adicione novos.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <FilterSidebar
          period={period}
          onPeriodChange={setPeriod}
          categories={categories}
          selectedCategories={selectedCats}
          onCategoriesChange={setSelectedCats}
          loadingCategories={loadingCategories}
          monthsWithData={monthsWithData}
        />

        <div className="min-w-0 space-y-4">
          {/* Filtros da lista + ação */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar descrição…"
                  className="w-full rounded-lg border border-brand-moss/25 bg-white py-2 pl-9 pr-3 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
                />
              </div>
              <div className="flex gap-1 rounded-lg bg-brand-light p-1">
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
                    onClick={() => setTypeFilter(value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      typeFilter === value
                        ? 'bg-white text-brand-moss shadow-sm'
                        : 'text-brand-gray hover:text-brand-moss'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoCategorize}
                disabled={autoCategorizing || loading}
                title="Preenche a categoria dos lançamentos sem categoria pela descrição"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-moss/25 px-4 py-2 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                {autoCategorizing ? 'Categorizando…' : 'Categorizar automaticamente'}
              </button>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-aqua px-4 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95"
              >
                <Plus className="h-4 w-4" />
                Novo lançamento
              </button>
            </div>
          </div>

          {/* Totais do período/filtro */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-brand-gray">
              {filtered.length} lançamento(s)
            </span>
            <span className="font-medium text-brand-income">
              {formatCurrencyAccounting(totals.income)}
            </span>
            <span className="font-medium text-brand-expense">
              {formatCurrencyAccounting(-totals.expense)}
            </span>
          </div>

          {/* Barra de edição em massa */}
          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-brand-aqua/40 bg-brand-aqua/10 p-3 sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-brand-moss">
                {selectedIds.size} selecionada(s)
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="w-full sm:w-64">
                  <CategorySelect
                    value={bulkCategory}
                    onChange={setBulkCategory}
                    categories={categories}
                    emptyOption={{ value: UNCATEGORIZED, label: 'Sem categoria' }}
                    placeholder="Mudar categoria para…"
                    ariaLabel="Nova categoria para os selecionados"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyBulkCategory}
                  disabled={!bulkCategory || applyingBulk}
                  className="rounded-lg bg-brand-aqua px-3 py-1.5 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyingBulk ? 'Aplicando…' : 'Aplicar'}
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm font-medium text-brand-gray transition hover:text-brand-moss"
              >
                Limpar
              </button>
            </div>
          )}

          {/* Lista */}
          <Card className="overflow-hidden p-0">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-brand-gray">
                Carregando…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-brand-gray">
                Nenhum lançamento neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-brand-moss/10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
                    <tr>
                      <th className="w-10 px-4 py-2.5">
                        <input
                          ref={headerCbRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="h-4 w-4 cursor-pointer accent-brand-aqua"
                          aria-label="Selecionar todos"
                        />
                      </th>
                      <th className="px-4 py-2.5 font-medium">Data</th>
                      <th className="px-4 py-2.5 font-medium">Descrição</th>
                      <th className="px-4 py-2.5 font-medium">Categoria</th>
                      <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-moss/10">
                    {filtered.map((tx) => {
                      const category = tx.categoryId
                        ? categoryById.get(tx.categoryId)
                        : undefined;
                      const inst = parseInstallment(tx.description);
                      const card = tx.cardId
                        ? categoryById.get(tx.cardId)
                        : undefined;
                      const signed =
                        tx.type === 'income' ? tx.amount : -tx.amount;
                      const selected = selectedIds.has(tx.id);
                      return (
                        <tr
                          key={tx.id}
                          className={
                            selected
                              ? 'bg-brand-aqua/10'
                              : 'hover:bg-brand-light/50'
                          }
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRow(tx.id)}
                              className="h-4 w-4 cursor-pointer accent-brand-aqua"
                              aria-label={`Selecionar ${tx.description}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-brand-gray">
                            {formatDate(tx.date)}
                          </td>
                          <td className="max-w-[24rem] px-4 py-2.5 font-medium text-brand-moss">
                            <div className="flex items-center gap-1.5">
                              {inst && (
                                <span
                                  className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                                  title={`Parcela ${inst.label}`}
                                >
                                  {inst.label}
                                </span>
                              )}
                              <span className="truncate">{tx.description}</span>
                            </div>
                            {(card || inst) && (
                              <div className="mt-0.5 flex items-center gap-1 text-xs text-brand-gray">
                                {card ? (
                                  <>
                                    <span
                                      className="flex h-3.5 w-3.5 items-center justify-center rounded"
                                      style={{
                                        backgroundColor: `${card.color ?? '#D8D8D8'}33`,
                                      }}
                                    >
                                      <CategoryIcon
                                        name={card.icon}
                                        className="h-2.5 w-2.5"
                                      />
                                    </span>
                                    <span className="truncate">{card.name}</span>
                                  </>
                                ) : (
                                  <span className="italic">
                                    Outra forma (transferência/boleto)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {category ? (
                              <span className="inline-flex items-center gap-1.5 text-brand-moss">
                                <span
                                  className="flex h-5 w-5 items-center justify-center rounded-md"
                                  style={{
                                    backgroundColor: `${category.color ?? '#D8D8D8'}33`,
                                  }}
                                >
                                  <CategoryIcon
                                    name={category.icon}
                                    className="h-3 w-3"
                                  />
                                </span>
                                {category.name}
                              </span>
                            ) : (
                              <span className="text-brand-gray">—</span>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${
                              tx.type === 'income'
                                ? 'text-brand-income'
                                : 'text-brand-expense'
                            }`}
                          >
                            {formatCurrencyAccounting(signed)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => openEdit(tx)}
                              className="rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-brand-moss"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(tx)}
                              className="rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-red-600"
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {editorOpen && (
        <TransactionEditor
          initial={editing}
          categories={categories}
          saving={saving}
          onClose={closeEditor}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
