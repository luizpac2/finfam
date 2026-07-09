import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Ban,
  Eraser,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { categoryRuleService, transactionService } from '../services';
import { normalizeText } from '../domain/categorizationEngine';
import {
  applyUserRules,
  categoryKindMap,
  categoryKindMatchesType,
  ruleMatches,
} from '../domain/ruleEngine';
import type { Category } from '../domain/entities/Category';
import {
  ruleConditionLabel,
  type CategoryRule,
  type RuleAction,
} from '../domain/entities/CategoryRule';
import { PaymentMethodLabel, PaymentMethodOrder } from '../domain/constants';
import type { PaymentMethod } from '../lib/database.types';
import { Card } from '../components/ui/Card';
import { CategorySelect } from '../components/ui/CategorySelect';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { CategoryIcon } from '../lib/categoryIcons';
import { formatCurrency } from '../lib/format';

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

/**
 * Decide se um lançamento deve ser PRESERVADO da aplicação de regras ao
 * histórico (não sobrescrever/excluir):
 *  - sempre que a categoria foi definida à mão (`manualCategory`);
 *  - e, quando a coluna `manual_category` ainda não existe (migração 0013 não
 *    aplicada), em MODO SEGURO: preserva tudo que já tem categoria, para nunca
 *    apagar uma edição manual.
 */
const isCategoryLocked = (
  tx: { manualCategory: boolean; categoryId: string | null },
  hasManualColumn: boolean
): boolean =>
  tx.manualCategory || (!hasManualColumn && tx.categoryId !== null);

/**
 * Gestão de regras de categorização por palavra-chave (somente Admin):
 *   - "categorizar": palavra na descrição → categoria.
 *   - "ignorar": palavra na descrição → ignora o lançamento na importação.
 */
export default function RulesPage() {
  const { profile } = useAuth();
  const toast = useToast();

  const {
    rules,
    categories,
    loadingRules,
    loadingCategories,
    refreshRules,
  } = useReferenceData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingAllIgnore, setApplyingAllIgnore] = useState(false);

  const [keyword, setKeyword] = useState('');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<RuleAction>('categorize');
  const [categoryId, setCategoryId] = useState('');
  const [rulePayment, setRulePayment] = useState<PaymentMethod | ''>('');
  const [filter, setFilter] = useState('');

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Ordena as regras alfabeticamente (palavra primeiro; sem palavra, por
  // categoria/valor) e aplica o filtro inteligente por palavra/categoria/valor.
  const prepareRules = useMemo(() => {
    const catName = (rule: CategoryRule) =>
      rule.categoryId
        ? normalizeText(categoryById.get(rule.categoryId)?.name ?? '')
        : '';
    const haystack = (rule: CategoryRule) =>
      normalizeText(
        `${rule.keyword ?? ''} ${catName(rule)} ${rule.amount ?? ''}`
      );
    const sortKey = (rule: CategoryRule) => {
      const kw = rule.keyword ? normalizeText(rule.keyword) : '';
      return kw ? `0${kw}` : `1${catName(rule)}${rule.amount ?? ''}`;
    };
    return (list: CategoryRule[]) => {
      const q = normalizeText(filter);
      return list
        .filter((r) => !q || haystack(r).includes(q))
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'pt-BR'));
    };
  }, [categoryById, filter]);

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
    if (action === 'categorize' && !categoryId && !rulePayment) {
      toast.error('Escolha a categoria e/ou a forma de pagamento da regra.');
      return;
    }
    setSaving(true);
    try {
      const wantedPayment = action === 'categorize' ? rulePayment || null : null;
      const created = await categoryRuleService.create({
        keyword: term || null,
        amount: value,
        action,
        categoryId: action === 'categorize' ? categoryId || null : null,
        paymentMethod: wantedPayment,
        createdBy: profile?.id ?? null,
      });
      setKeyword('');
      setAmount('');
      setCategoryId('');
      setRulePayment('');
      // Se a coluna `payment_method` (migração 0017) ainda não existe, o serviço
      // grava a regra sem a forma — avisa em vez de perdê-la em silêncio.
      if (wantedPayment && !created.paymentMethod) {
        toast.info(
          'Regra criada, mas a forma de pagamento não foi salva: rode a migração 0017 no Supabase.'
        );
      } else {
        toast.success('Regra criada.');
      }
      await refreshRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // Aplica UMA regra a todo o histórico: recategoriza e/ou define a forma de
  // pagamento dos lançamentos cuja descrição/valor casam com a regra.
  const applyRuleToHistory = async (rule: CategoryRule) => {
    if (rule.action !== 'categorize' || (!rule.categoryId && !rule.paymentMethod))
      return;
    setApplyingId(rule.id);
    try {
      const hasManual = await transactionService.hasManualCategoryColumn();
      const all = await transactionService.listLite({});
      const ruleKind = rule.categoryId
        ? categoryById.get(rule.categoryId)?.kind
        : undefined;
      // Categoria: respeita o tipo e não toca no que já está certo.
      const catIds =
        rule.categoryId != null
          ? all
              .filter(
                (tx) =>
                  !isCategoryLocked(tx, hasManual) &&
                  categoryKindMatchesType(ruleKind, tx.type) &&
                  tx.categoryId !== rule.categoryId &&
                  ruleMatches(rule, tx.description, tx.amount)
              )
              .map((tx) => tx.id)
          : [];
      // Forma de pagamento: só onde ainda difere.
      const payIds =
        rule.paymentMethod != null
          ? all
              .filter(
                (tx) =>
                  !isCategoryLocked(tx, hasManual) &&
                  tx.paymentMethod !== rule.paymentMethod &&
                  ruleMatches(rule, tx.description, tx.amount)
              )
              .map((tx) => tx.id)
          : [];

      const total = new Set([...catIds, ...payIds]).size;
      if (total === 0) {
        toast.info('Nenhum lançamento do histórico para atualizar.');
        return;
      }
      if (
        !window.confirm(
          `Aplicar a regra "${ruleConditionLabel(rule, formatCurrency)}" a ${total} lançamento(s) do histórico?`
        )
      )
        return;

      if (catIds.length > 0)
        await transactionService.setCategoryMany(catIds, rule.categoryId);
      if (payIds.length > 0)
        await transactionService.setPaymentMethodMany(payIds, rule.paymentMethod);
      toast.success(`${total} lançamento(s) atualizados.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aplicar a regra.');
    } finally {
      setApplyingId(null);
    }
  };

  // Aplica TODAS as regras de categorização ao histórico de uma vez
  // (categoria e/ou forma de pagamento).
  const applyAllToHistory = async () => {
    const hasCategorize = rules.some(
      (r) => r.action === 'categorize' && (r.categoryId || r.paymentMethod)
    );
    if (!hasCategorize) {
      toast.info('Nenhuma regra de categorização para aplicar.');
      return;
    }
    setApplyingAll(true);
    try {
      const hasManual = await transactionService.hasManualCategoryColumn();
      const all = await transactionService.listLite({});
      const kindById = categoryKindMap(categories);
      const catGroups = new Map<string, string[]>();
      const payGroups = new Map<PaymentMethod, string[]>();
      const touched = new Set<string>();
      for (const tx of all) {
        if (isCategoryLocked(tx, hasManual)) continue; // preserva edições manuais
        const { categoryId, paymentMethod } = applyUserRules(
          tx.description,
          tx.amount,
          tx.type,
          rules,
          kindById
        );
        if (categoryId && tx.categoryId !== categoryId) {
          const list = catGroups.get(categoryId) ?? [];
          list.push(tx.id);
          catGroups.set(categoryId, list);
          touched.add(tx.id);
        }
        if (paymentMethod && tx.paymentMethod !== paymentMethod) {
          const list = payGroups.get(paymentMethod) ?? [];
          list.push(tx.id);
          payGroups.set(paymentMethod, list);
          touched.add(tx.id);
        }
      }

      const total = touched.size;
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

      for (const [catId, ids] of catGroups) {
        await transactionService.setCategoryMany(ids, catId);
      }
      for (const [method, ids] of payGroups) {
        await transactionService.setPaymentMethodMany(ids, method);
      }
      toast.success(`${total} lançamento(s) atualizados.`);
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
      const hasManual = await transactionService.hasManualCategoryColumn();
      const all = await transactionService.listLite({});
      const ids = all
        .filter(
          (tx) =>
            !isCategoryLocked(tx, hasManual) && // não exclui o que foi curado à mão
            ruleMatches(rule, tx.description, tx.amount)
        )
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
      const hasManual = await transactionService.hasManualCategoryColumn();
      const all = await transactionService.listLite({});
      const kindById = categoryKindMap(categories);
      const ids = all
        .filter(
          (tx) =>
            !isCategoryLocked(tx, hasManual) &&
            applyUserRules(tx.description, tx.amount, tx.type, rules, kindById)
              .ignore
        )
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
      await refreshRules();
      toast.success('Regra excluída.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  if (loadingRules || loadingCategories)
    return <FullScreenLoader label="Carregando regras…" />;

  const categorizeRules = prepareRules(
    rules.filter((r) => r.action === 'categorize')
  );
  const ignoreRules = prepareRules(rules.filter((r) => r.action === 'ignore'));
  const totalRules = rules.length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Regras de categorização
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Categorize (ou ignore) por <strong>palavra</strong> na descrição e/ou
          por <strong>valor</strong> — ex.: “se for R$ 133,43, categorizar como
          Seguro”. Vale na importação e ao “Categorizar automaticamente”.
        </p>
      </header>

      {/* Formulário — compacto */}
      <Card className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-gray">
          Nova regra
        </p>
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="min-w-[11rem] flex-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Palavra na descrição (opcional)"
              aria-label="Palavra na descrição"
              className={inputClass}
            />
          </div>
          <div className="w-28">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Valor"
              aria-label="Valor"
              className={`${inputClass} text-right`}
            />
          </div>
          <div className="flex shrink-0 rounded-lg bg-brand-light p-0.5">
            {(['categorize', 'ignore'] as RuleAction[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                  action === a
                    ? 'bg-white text-brand-moss shadow-sm'
                    : 'text-brand-gray'
                }`}
              >
                {a === 'categorize' ? 'Categorizar' : 'Ignorar'}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-56">
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              disabled={action === 'ignore'}
              placeholder={action === 'ignore' ? '— (ignorar)' : 'Categoria…'}
              className="py-2"
            />
          </div>
          <div className="w-full sm:w-44">
            <select
              value={rulePayment}
              onChange={(e) =>
                setRulePayment(e.target.value as PaymentMethod | '')
              }
              disabled={action === 'ignore'}
              aria-label="Forma de pagamento da regra"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">Forma de pagamento…</option>
              {PaymentMethodOrder.map((m) => (
                <option key={m} value={m}>
                  {PaymentMethodLabel[m]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
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

      {/* Filtro inteligente */}
      {totalRules > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por palavra, categoria ou valor…"
            className="w-full rounded-lg border border-brand-moss/20 bg-white py-2 pl-9 pr-3 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
          />
        </div>
      )}

      {/* Listas */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
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
                  <span className="inline-flex items-center gap-1.5">
                    {rule.categoryId && (
                      <span className="inline-flex items-center gap-1.5 text-brand-moss">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: `${category?.color ?? '#D8D8D8'}33`,
                          }}
                        >
                          <CategoryIcon
                            name={category?.icon}
                            className="h-3 w-3"
                          />
                        </span>
                        {category?.name ?? 'Categoria removida'}
                      </span>
                    )}
                    {rule.paymentMethod && (
                      <span className="inline-flex items-center rounded-md bg-brand-aqua/15 px-1.5 py-0.5 text-xs font-medium text-brand-moss">
                        {PaymentMethodLabel[rule.paymentMethod]}
                      </span>
                    )}
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

      {/* Como as regras funcionam */}
      <Card className="bg-brand-light/40">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-moss">
          <Info className="h-4 w-4 text-brand-aqua" strokeWidth={1.8} />
          Como as regras funcionam
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed text-brand-gray">
          <li>
            <strong className="text-brand-moss">Palavra e/ou valor.</strong> A
            regra casa quando a palavra aparece na descrição <em>e</em> o valor
            (se informado) é igual. Regras mais específicas — com valor, ou
            palavra mais longa — têm prioridade.
          </li>
          <li>
            <strong className="text-brand-moss">
              Respeita o tipo (receita × despesa).
            </strong>{' '}
            Uma regra cuja categoria é de{' '}
            <span className="font-medium text-brand-income">receita</span> só se
            aplica a lançamentos de receita; categoria de{' '}
            <span className="font-medium text-brand-expense">despesa</span> (ou
            cartão), só a despesas. Ex.: se a escola paga o salário (receita) e
            também há compras feitas nela (despesa) com a mesma descrição, cada
            um é categorizado no lado certo — a despesa nunca vira a categoria de
            receita.
          </li>
          <li>
            <strong className="text-brand-moss">
              Forma de pagamento (opcional).
            </strong>{' '}
            A regra também pode definir a{' '}
            <span className="font-medium">forma de movimentação</span> (Pix, TED,
            dinheiro, cartão…). Assim, por exemplo, tudo que contém “PIX” já entra
            classificado como Pix — na importação e ao aplicar ao histórico. Uma
            regra pode definir só a forma, só a categoria, ou as duas.
          </li>
          <li>
            <strong className="text-brand-moss">Categorizar × Ignorar.</strong>{' '}
            “Categorizar” define a categoria; “Ignorar” descarta o lançamento na
            importação (ou exclui do histórico). Se alguma regra de “Ignorar”
            casa, ela tem prioridade.
          </li>
          <li>
            <strong className="text-brand-moss">
              Edição manual é protegida.
            </strong>{' '}
            Se você definiu a categoria de um lançamento à mão, aplicar regras ao
            histórico não sobrescreve nem exclui esse lançamento.
          </li>
          <li>
            <strong className="text-brand-moss">Aplicar ao histórico.</strong> O
            botão de recarregar em cada regra (ou “Aplicar ao histórico” no topo)
            reprocessa os lançamentos já salvos, seguindo todas as regras acima.
          </li>
        </ul>
      </Card>
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
    <li className="flex items-center justify-between gap-3 px-4 py-2">
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
