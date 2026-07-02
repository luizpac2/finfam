import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { useToast } from '../hooks/useToast';
import { categoryService } from '../services';
import type { Category } from '../domain/entities/Category';
import type { CategoryKind } from '../lib/database.types';
import { Card } from '../components/ui/Card';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { IconPicker } from '../components/ui/IconPicker';
import { CategoryIcon } from '../lib/categoryIcons';

const DEFAULT_COLOR = '#9BBFB5';

interface CategoryForm {
  id: string | null;
  name: string;
  kind: CategoryKind;
  parentId: string;
  icon: string;
  color: string;
}

const emptyForm: CategoryForm = {
  id: null,
  name: '',
  kind: 'expense',
  parentId: '',
  icon: 'tag',
  color: DEFAULT_COLOR,
};

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

/** Gestão de categorias (somente Admin): tipo, subcategorias, ícone e cor. */
export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setCategories(await categoryService.list());
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

  // Categorias-raiz do tipo selecionado, candidatas a "pai" (exclui a própria).
  const parentChoices = useMemo(
    () =>
      categories.filter(
        (c) => !c.parentId && c.kind === form.kind && c.id !== form.id
      ),
    [categories, form.kind, form.id]
  );

  const resetForm = () => setForm(emptyForm);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const parent = categories.find((c) => c.id === form.parentId) ?? null;
    const payload = {
      name: form.name.trim(),
      icon: form.icon || null,
      color: form.color,
      kind: parent ? parent.kind : form.kind, // subcategoria herda o tipo do pai
      parentId: form.parentId || null,
    };
    try {
      if (form.id) {
        await categoryService.update(form.id, payload);
        toast.success('Categoria atualizada.');
      } else {
        await categoryService.create(payload);
        toast.success('Categoria criada.');
      }
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: Category) => {
    setForm({
      id: category.id,
      name: category.name,
      kind: category.kind,
      parentId: category.parentId ?? '',
      icon: category.icon ?? 'tag',
      color: category.color ?? DEFAULT_COLOR,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (category: Category) => {
    setBusyId(category.id);
    try {
      await categoryService.remove(category.id);
      if (form.id === category.id) resetForm();
      await load();
      toast.success(`"${category.name}" excluída.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FullScreenLoader label="Carregando categorias…" />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Separe por receita e despesa, crie subcategorias e escolha ícone e cor.
        </p>
      </header>

      {/* Formulário (criar / editar) */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-brand-moss">
          {form.id ? 'Editar categoria' : 'Nova categoria'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="lg:col-span-2">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Nome
              </span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Alimentação"
                className={inputClass}
              />
            </label>

            <div>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Tipo
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-light p-1">
                {(['income', 'expense'] as CategoryKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={Boolean(form.parentId)}
                    onClick={() =>
                      setForm((f) => ({ ...f, kind: k, parentId: '' }))
                    }
                    className={`rounded-md py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                      (form.parentId
                        ? parentChoices.find((c) => c.id === form.parentId)?.kind
                        : form.kind) === k
                        ? 'bg-white text-brand-moss shadow-sm'
                        : 'text-brand-gray'
                    }`}
                  >
                    {k === 'income' ? 'Receita' : 'Despesa'}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Categoria pai
              </span>
              <select
                value={form.parentId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentId: e.target.value }))
                }
                className={inputClass}
              >
                <option value="">Nenhuma (principal)</option>
                {parentChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Ícone
              </span>
              <IconPicker
                value={form.icon}
                color={form.color}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              />
            </div>
            <label>
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Cor
              </span>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-[38px] w-14 cursor-pointer rounded-lg border border-brand-moss/25 bg-white p-1"
                aria-label="Cor"
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-moss/25 px-4 py-2 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : form.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {form.id ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* Listas por tipo */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryColumn
          title="Receitas"
          kind="income"
          categories={categories}
          busyId={busyId}
          onEdit={startEdit}
          onRemove={remove}
        />
        <CategoryColumn
          title="Despesas"
          kind="expense"
          categories={categories}
          busyId={busyId}
          onEdit={startEdit}
          onRemove={remove}
        />
      </div>
    </div>
  );
}

interface ColumnProps {
  title: string;
  kind: CategoryKind;
  categories: Category[];
  busyId: string | null;
  onEdit: (category: Category) => void;
  onRemove: (category: Category) => void;
}

function CategoryColumn({
  title,
  kind,
  categories,
  busyId,
  onEdit,
  onRemove,
}: ColumnProps) {
  const scoped = categories.filter((c) => c.kind === kind);
  const roots = scoped
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const childrenOf = (id: string) =>
    scoped
      .filter((c) => c.parentId === id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            kind === 'income' ? 'bg-brand-aqua' : 'bg-brand-moss'
          }`}
        />
        <h2 className="text-base font-semibold text-brand-moss">{title}</h2>
        <span className="text-sm text-brand-gray">({scoped.length})</span>
      </div>
      <Card className="overflow-hidden p-0">
        {roots.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-brand-gray">
            Nenhuma categoria de {title.toLowerCase()} ainda.
          </p>
        ) : (
          <ul className="divide-y divide-brand-moss/10">
            {roots.map((root) => (
              <li key={root.id}>
                <CategoryRow
                  category={root}
                  busy={busyId === root.id}
                  onEdit={onEdit}
                  onRemove={onRemove}
                />
                {childrenOf(root.id).map((child) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    nested
                    busy={busyId === child.id}
                    onEdit={onEdit}
                    onRemove={onRemove}
                  />
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface RowProps {
  category: Category;
  nested?: boolean;
  busy: boolean;
  onEdit: (category: Category) => void;
  onRemove: (category: Category) => void;
}

function CategoryRow({ category, nested, busy, onEdit, onRemove }: RowProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        nested ? 'border-t border-brand-moss/5 bg-brand-light/40 pl-10' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${category.color ?? '#D8D8D8'}33` }}
        >
          <CategoryIcon
            name={category.icon}
            className="h-4 w-4"
          />
        </span>
        <span className="truncate text-sm font-medium text-brand-moss">
          {category.name}
        </span>
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-brand-moss/10"
          style={{ backgroundColor: category.color ?? '#D8D8D8' }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(category)}
          disabled={busy}
          className="rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-brand-moss disabled:opacity-50"
          aria-label={`Editar ${category.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(category)}
          disabled={busy}
          className="rounded-lg p-1.5 text-brand-gray transition hover:bg-white hover:text-red-600 disabled:opacity-50"
          aria-label={`Excluir ${category.name}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
