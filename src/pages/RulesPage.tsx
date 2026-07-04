import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Ban, Eraser, Loader2, Plus, RefreshCw, Tag, Trash2 } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  categoryRuleService,
  categoryService,
  transactionService,
} from '../services';
import { applyUserRules, ruleMatches } from '../domain/ruleEngine';
import type { Category } from '../domain/entities/Category';
import {
  ruleConditionLabel,
  type CategoryRule,
  type RuleAction,
} from '../domain/entities/CategoryRule';
import { Card } from '../components/ui/Card';
import { CategorySelect } from '../components/ui/CategorySelect';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrency } from '../lib/format';

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

/**
 * Gestão de regras de categorização por palavra-chave (somente Admin):
 *   - "categorizar": palavra na descrição → categoria.
 *   - "ignorar": palavra na descrição → ignora o lançamento na importação.
 */
export default function RulesPage() {
  const { profile } = useAuth();
  const toast = useToast();

  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingAllIgnore, setApplyingAllIgnore] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<RuleAction>('categorize');
  const [categoryId, setCategoryId] = useState('');

  const load = async () => {
    try {
      const [r, c] = await Promise.all([
        categoryRuleService.list(),
        categoryService.list(),
      ]);
      setRules(r);
      setCategories(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const term = keyword.trim();
    const raw = amount.trim();
    const value = raw ? Math.abs(Number(raw.replace(',', '.'))) : null;
    if (!term && (value == null || Number.isNaN(value))) {
      toast.error('Informe uma palavra e/ou um valor.');
      return;
    }
    if (value != null && Number.isNaN(value)) {
      toast.error('Valor inválido.');
      return;
    }
    if (action === 'categorize' && !categoryId) {
      toast.error('Escolha a categoria para a regra.');
      return;
    }
    setSaving(true);
    try {
      await categoryRuleService.create({
        keyword: term || null,
        amount: value,
        action,
        categoryId: action === 'categorize' ? categoryId : null,
        createdBy: profile?.id ?? null,
      });
      setKeyword('');
      setAmount('');
      setCategoryId('');
      toast.success('Regra criada.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // Aplica UMA regra a todo o histórico: recategoriza os lançamentos (mesmo os
  // já categorizados) cuja descrição contém a palavra da regra.
  const applyRuleToHistory = async (rule: CategoryRule) => {
    if (rule.action !== 'categorize' || !rule.categoryId) return;
    const catName = categoryById.get(rule.categoryId)?.name ?? 'a categoria';
    setApplyingId(rule.id);
    try {
      const all = await transactionService.list({});
      const ids = all
        .filter(
          (tx) =>
            tx.categoryId !== rule.categoryId &&
            ruleMatches(rule, tx.description, tx.amount)
        )
        .map((tx) => tx.id);

      if (ids.length === 0) {
        toast.info('Nenhum lançamento do histórico para atualizar.');
        return;
      }
      if (
        !window.confirm(
          `Recategorizar ${ids.length} lançamento(s) que casam com "${ruleConditionLabel(rule, formatCurrency)}" para "${catName}"? Isso vale para todo o histórico.`
        )
      )
        return;

      await transactionService.setCategoryMany(ids, rule.categoryId);
      toast.success(`${ids.length} lançamento(s) recategorizados.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aplicar a regra.');
    } finally {
      setApplyingId(null);
    }
  };

  // Aplica TODAS as regras de categorização ao histórico de uma vez.
  const applyAllToHistory = async () => {
    const hasCategorize = rules.some(
      (r) => r.action === 'categorize' && r.categoryId
    );
    if (!hasCategorize) {
      toast.info('Nenhuma regra de categorização para aplicar.');
      return;
    }
    setApplyingAll(true);
    try {
      const all = await transactionService.list({});
      const groups = new Map<string, string[]>();
      for (const tx of all) {
        const { categoryId } = applyUserRules(tx.description, tx.amount, rules);
        if (!categoryId || tx.categoryId === categoryId) continue;
        const list = groups.get(categoryId) ?? [];
        list.push(tx.id);
        groups.set(categoryId, list);
      }

      const total = [...groups.values()].reduce((n, ids) => n + ids.length, 0);
      if (total === 0) {
        toast.info('Nenhum lançamento do histórico para atualizar.');
        return;
      }
      if (
        !window.confirm(
          `Aplicar todas as regras a ${total} lançamento(s) do histórico?`
        )
      )
        return;

      for (const [catId, ids] of groups) {
        await transactionService.setCategoryMany(ids, catId);
      }
      toast.success(`${total} lançamento(s) recategorizados.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Falha ao aplicar as regras.'
      );
    } finally {
      setApplyingAll(false);
    }
  };

  // Aplica UMA regra de "ignorar" ao histórico: EXCLUI permanentemente os
  // lançamentos cuja descrição contém a palavra.
  const applyIgnoreRuleToHistory = async (rule: CategoryRule) => {
    if (rule.action !== 'ignore') return;
    setApplyingId(rule.id);
    try {
      const all = await transactionService.list({});
      const ids = all
        .filter((tx) => ruleMatches(rule, tx.description, tx.amount))
        .map((tx) => tx.id);

      if (ids.length === 0) {
        toast.info('Nenhum lançamento do histórico para excluir.');
        return;
      }
      if (
        !window.confirm(
          `Excluir PERMANENTEMENTE ${ids.length} lançamento(s) que casam com "${ruleConditionLabel(rule, formatCurrency)}"? Isso vale para todo o histórico e não pode ser desfeito.`
        )
      )
        return;

      await transactionService.removeMany(ids);
      toast.success(`${ids.length} lançamento(s) excluídos.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setApplyingId(null);
    }
  };

  // Aplica TODAS as regras de "ignorar" ao histórico de uma vez (exclui).
  const applyAllIgnoreToHistory = async () => {
    if (!rules.some((r) => r.action === 'ignore')) {
      toast.info('Nenhuma regra de ignorar para aplicar.');
      return;
    }
    setApplyingAllIgnore(true);
    try {
      const all = await transactionService.list({});
      const ids = all
        .filter((tx) => applyUserRules(tx.description, tx.amount, rules).ignore)
        .map((tx) => tx.id);

      if (ids.length === 0) {
        toast.info('Nenhum lançamento do histórico para excluir.');
        return;
      }
      if (
        !window.confirm(
          `Excluir PERMANENTEMENTE ${ids.length} lançamento(s) que casam com alguma regra de ignorar? Não pode ser desfeito.`
        )
      )
        return;

      await transactionService.removeMany(ids);
      toast.success(`${ids.length} lançamento(s) excluídos.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setApplyingAllIgnore(false);
    }
  };

  const remove = async (rule: CategoryRule) => {
    setBusyId(rule.id);
    try {
      await categoryRuleService.remove(rule.id);
      await load();
      toast.success('Regra excluída.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FullScreenLoader label="Carregando regras…" />;

  const categorizeRules = rules.filter((r) => r.action === 'categorize');
  const ignoreRules = rules.filter((r) => r.action === 'ignore');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Regras de categorização
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Categorize (ou ignore) automaticamente por <strong>palavra</strong> na
          descrição e/ou por <strong>valor</strong> do lançamento — ex.:
          “sempre que for R$ 133,43, categorizar como Seguro”. Vale na importação
          e no botão “Categorizar automaticamente”.
        </p>
      </header>

      {/* Formulário */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Palavra na descrição{' '}
                <span className="font-normal text-brand-gray">(opcional)</span>
              </span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ex.: Luz, ENEL, Netflix…"
                className={inputClass}
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Valor{' '}
                <span className="font-normal text-brand-gray">(opcional)</span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex.: 133,43"
                className={`${inputClass} text-right`}
              />
            </label>

            <div>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Ação
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-light p-1">
                {(['categorize', 'ignore'] as RuleAction[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`rounded-md px-1 py-1.5 text-sm font-medium transition ${
                      action === a
                        ? 'bg-white text-brand-moss shadow-sm'
                        : 'text-brand-gray'
                    }`}
                  >
                    {a === 'categorize' ? 'Categorizar' : 'Ignorar'}
                  </button>
                ))}
              </div>
            </div>

            <label className="lg:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Categoria
              </span>
              <CategorySelect
                value={categoryId}
                onChange={setCategoryId}
                categories={categories}
                disabled={action === 'ignore'}
                placeholder={action === 'ignore' ? '— (ignorar)' : 'Selecione…'}
                className="py-2"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar regra
            </button>
          </div>
        </form>
      </Card>

      {/* Listas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RuleColumn
          title="Categorizar"
          icon={Tag}
          count={categorizeRules.length}
          action={
            categorizeRules.length > 0 && (
              <button
                type="button"
                onClick={applyAllToHistory}
                disabled={applyingAll || applyingId !== null}
                title="Aplica todas as regras a todo o histórico de lançamentos"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-moss/25 px-2.5 py-1 text-xs font-medium text-brand-moss transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applyingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Aplicar ao histórico
              </button>
            )
          }
        >
          {categorizeRules.length === 0 ? (
            <Empty text="Nenhuma regra de categorização ainda." />
          ) : (
            categorizeRules.map((rule) => {
              const category = rule.categoryId
                ? categoryById.get(rule.categoryId)
                : undefined;
              return (
                <RuleRow
                  key={rule.id}
                  keyword={rule.keyword}
                  amount={rule.amount}
                  busy={busyId === rule.id}
                  onRemove={() => remove(rule)}
                  onApply={() => applyRuleToHistory(rule)}
                  applying={applyingId === rule.id}
                >
                  <span className="inline-flex items-center gap-1.5 text-brand-moss">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${category?.color ?? '#D8D8D8'}33`,
                      }}
                    >
                      <CategoryIcon name={category?.icon} className="h-3 w-3" />
                    </span>
                    {category?.name ?? 'Categoria removida'}
                  </span>
                </RuleRow>
              );
            })
          )}
        </RuleColumn>

        <RuleColumn
          title="Ignorar"
          icon={Ban}
          count={ignoreRules.length}
          action={
            ignoreRules.length > 0 && (
              <button
                type="button"
                onClick={applyAllIgnoreToHistory}
                disabled={applyingAllIgnore || applyingId !== null}
                title="Exclui do histórico todos os lançamentos que casam com as regras de ignorar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applyingAllIgnore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Excluir do histórico
              </button>
            )
          }
        >
          {ignoreRules.length === 0 ? (
            <Empty text="Nenhuma palavra ignorada ainda." />
          ) : (
            ignoreRules.map((rule) => (
              <RuleRow
                key={rule.id}
                keyword={rule.keyword}
                amount={rule.amount}
                busy={busyId === rule.id}
                onRemove={() => remove(rule)}
                onApply={() => applyIgnoreRuleToHistory(rule)}
                applying={applyingId === rule.id}
                applyIcon="delete"
                applyTitle="Excluir do histórico os lançamentos que casam"
              >
                <span className="text-sm italic text-brand-gray">
                  ignorar na importação
                </span>
              </RuleRow>
            ))
          )}
        </RuleColumn>
      </div>
    </div>
  );
}

function RuleColumn({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string;
  icon: typeof Tag;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-aqua" strokeWidth={1.8} />
        <h2 className="text-base font-semibold text-brand-moss">{title}</h2>
        <span className="text-sm text-brand-gray">({count})</span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-brand-moss/10">{children}</ul>
      </Card>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <li className="px-4 py-6 text-center text-sm text-brand-gray">{text}</li>
  );
}

function RuleRow({
  keyword,
  amount,
  busy,
  onRemove,
  onApply,
  applying = false,
  applyIcon = 'apply',
  applyTitle = 'Aplicar esta regra a todo o histórico',
  children,
}: {
  keyword: string;
  amount: number | null;
  busy: boolean;
  onRemove: () => void;
  onApply?: () => void;
  applying?: boolean;
  applyIcon?: 'apply' | 'delete';
  applyTitle?: string;
  children: ReactNode;
}) {
  const isDelete = applyIcon === 'delete';
  const label = ruleConditionLabel({ keyword, amount }, formatCurrency);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {keyword && (
            <span className="rounded-md bg-brand-light px-2 py-0.5 text-sm font-semibold text-brand-moss">
              {keyword}
            </span>
          )}
          {keyword && amount != null && (
            <span className="text-xs text-brand-gray">+</span>
          )}
          {amount != null && (
            <span className="rounded-md bg-brand-aqua/20 px-2 py-0.5 text-sm font-semibold text-brand-moss">
              {formatCurrency(amount)}
            </span>
          )}
        </div>
        <span className="text-brand-gray">→</span>
        <span className="min-w-0 truncate">{children}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onApply && (
          <button
            type="button"
            onClick={onApply}
            disabled={applying || busy}
            title={applyTitle}
            className={`rounded-lg p-1.5 text-brand-gray transition hover:bg-white disabled:opacity-50 ${
              isDelete ? 'hover:text-red-600' : 'hover:text-brand-moss'
            }`}
            aria-label={`${applyTitle} (${label})`}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isDelete ? (
              <Eraser className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-red-600 disabled:opacity-50"
          aria-label={`Excluir regra ${label}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </li>
  );
}
