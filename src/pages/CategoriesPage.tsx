import { useEffect, useState, type FormEvent } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { useToast } from '../hooks/useToast';
import { categoryService } from '../services';
import type { Category, CategoryInput } from '../domain/entities/Category';
import { Card } from '../components/ui/Card';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';

const DEFAULT_COLOR = '#9BBFB5';

const emptyForm: CategoryInput = { name: '', color: DEFAULT_COLOR, icon: '' };

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

/**
 * Gestão de categorias (somente Admin, por RLS): criar, editar e excluir.
 */
export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formulário de criação
  const [form, setForm] = useState<CategoryInput>(emptyForm);
  const [creating, setCreating] = useState(false);

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryInput>(emptyForm);

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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await categoryService.create({
        name: form.name.trim(),
        color: form.color,
        icon: form.icon?.trim() || null,
      });
      setForm(emptyForm);
      await load();
      toast.success('Categoria criada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      color: category.color ?? DEFAULT_COLOR,
      icon: category.icon ?? '',
    });
  };

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) return;
    setBusyId(id);
    try {
      await categoryService.update(id, {
        name: editForm.name.trim(),
        color: editForm.color,
        icon: editForm.icon?.trim() || null,
      });
      setEditingId(null);
      await load();
      toast.success('Categoria atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (category: Category) => {
    setBusyId(category.id);
    try {
      await categoryService.remove(category.id);
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
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Organize as categorias usadas na categorização e nos gráficos.
        </p>
      </header>

      {/* Nova categoria */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-brand-moss">
          Nova categoria
        </h2>
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1">
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
          <label className="sm:w-40">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Ícone (opcional)
            </span>
            <input
              type="text"
              value={form.icon ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="ex.: home"
              className={inputClass}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Cor
            </span>
            <input
              type="color"
              value={form.color ?? DEFAULT_COLOR}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="h-[38px] w-14 cursor-pointer rounded-lg border border-brand-moss/25 bg-white p-1"
              aria-label="Cor"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Adicionar
          </button>
        </form>
      </Card>

      {/* Lista */}
      <h2 className="text-lg font-semibold text-brand-moss">
        Todas as categorias ({categories.length})
      </h2>
      <Card className="overflow-hidden p-0">
        {categories.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-gray">
            Nenhuma categoria ainda. Crie a primeira acima.
          </p>
        ) : (
          <ul className="divide-y divide-brand-moss/10">
            {categories.map((category) => {
              const editing = editingId === category.id;
              const busy = busyId === category.id;
              return (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editing ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="color"
                        value={editForm.color ?? DEFAULT_COLOR}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, color: e.target.value }))
                        }
                        className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-brand-moss/25 bg-white p-1"
                        aria-label="Cor"
                      />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className={`${inputClass} sm:max-w-xs`}
                        aria-label="Nome"
                      />
                      <input
                        type="text"
                        value={editForm.icon ?? ''}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, icon: e.target.value }))
                        }
                        placeholder="ícone"
                        className={`${inputClass} sm:max-w-[10rem]`}
                        aria-label="Ícone"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full ring-1 ring-brand-moss/10"
                        style={{ backgroundColor: category.color ?? '#D8D8D8' }}
                      />
                      <span className="font-medium text-brand-moss">
                        {category.name}
                      </span>
                      {category.icon && (
                        <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-gray">
                          {category.icon}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(category.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-aqua px-3 py-1.5 text-sm font-medium text-brand-moss transition hover:brightness-95 disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-moss/25 px-3 py-1.5 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-moss/25 px-3 py-1.5 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(category)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-gray transition hover:text-red-600 disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
