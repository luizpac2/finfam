import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Ban, Loader2, Plus, Tag, Trash2 } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { categoryRuleService, categoryService } from '../services';
import type { Category } from '../domain/entities/Category';
import type {
  CategoryRule,
  RuleAction,
} from '../domain/entities/CategoryRule';
import { Card } from '../components/ui/Card';
import { CategorySelect } from '../components/ui/CategorySelect';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { CategoryIcon } from '../lib/categoryIcons';

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

  const [keyword, setKeyword] = useState('');
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
    if (!term) return;
    if (action === 'categorize' && !categoryId) {
      toast.error('Escolha a categoria para a regra.');
      return;
    }
    setSaving(true);
    try {
      await categoryRuleService.create({
        keyword: term,
        action,
        categoryId: action === 'categorize' ? categoryId : null,
        createdBy: profile?.id ?? null,
      });
      setKeyword('');
      setCategoryId('');
      toast.success('Regra criada.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
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
          Quando uma palavra aparece na descrição, o lançamento é categorizado
          automaticamente — ou ignorado — na importação e no botão "Categorizar
          automaticamente".
        </p>
      </header>

      {/* Formulário */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="lg:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Palavra na descrição
              </span>
              <input
                type="text"
                required
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Ex.: Luz, ENEL, Netflix…"
                className={inputClass}
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

            <label>
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
        <RuleColumn title="Categorizar" icon={Tag} count={categorizeRules.length}>
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
                  busy={busyId === rule.id}
                  onRemove={() => remove(rule)}
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

        <RuleColumn title="Ignorar" icon={Ban} count={ignoreRules.length}>
          {ignoreRules.length === 0 ? (
            <Empty text="Nenhuma palavra ignorada ainda." />
          ) : (
            ignoreRules.map((rule) => (
              <RuleRow
                key={rule.id}
                keyword={rule.keyword}
                busy={busyId === rule.id}
                onRemove={() => remove(rule)}
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
  children,
}: {
  title: string;
  icon: typeof Tag;
  count: number;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-aqua" strokeWidth={1.8} />
        <h2 className="text-base font-semibold text-brand-moss">{title}</h2>
        <span className="text-sm text-brand-gray">({count})</span>
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
  busy,
  onRemove,
  children,
}: {
  keyword: string;
  busy: boolean;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 rounded-md bg-brand-light px-2 py-0.5 text-sm font-semibold text-brand-moss">
          {keyword}
        </span>
        <span className="text-brand-gray">→</span>
        <span className="min-w-0 truncate">{children}</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="shrink-0 rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-red-600 disabled:opacity-50"
        aria-label={`Excluir regra ${keyword}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </li>
  );
}
