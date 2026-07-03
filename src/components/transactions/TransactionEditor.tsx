import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { buildCategoryOptions, type Category } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import type {
  TransactionStatus,
  TransactionType,
} from '../../lib/database.types';
import { TransactionStatusLabel } from '../../domain/constants';

export interface TransactionFormValues {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  status: TransactionStatus;
}

interface TransactionEditorProps {
  /** Lançamento em edição, ou null para um novo. */
  initial: Transaction | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => void;
}

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

const STATUSES: TransactionStatus[] = ['pending', 'paid', 'cancelled'];

export function TransactionEditor({
  initial,
  categories,
  saving,
  onClose,
  onSubmit,
}: TransactionEditorProps) {
  const [form, setForm] = useState(() => ({
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    description: initial?.description ?? '',
    type: (initial?.type ?? 'expense') as TransactionType,
    amount: initial ? String(initial.amount) : '',
    categoryId: initial?.categoryId ?? '',
    status: (initial?.status ?? 'pending') as TransactionStatus,
  }));

  const categoryOptions = buildCategoryOptions(categories, form.type);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const amount = Math.abs(Number(form.amount)) || 0;
    if (!form.description.trim() || !form.date || amount === 0) return;
    onSubmit({
      date: form.date,
      description: form.description.trim(),
      type: form.type,
      amount,
      categoryId: form.categoryId,
      status: form.status,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar lançamento' : 'Novo lançamento'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-moss">
            Descrição
          </span>
          <input
            type="text"
            required
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className={inputClass}
            placeholder="Ex.: Mercado, Salário…"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Data
            </span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Valor
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={`${inputClass} text-right ${
                form.type === 'income'
                  ? 'text-brand-income'
                  : 'text-brand-expense'
              }`}
              placeholder="0,00"
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-brand-moss">
            Tipo
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-light p-1">
            {(['income', 'expense'] as TransactionType[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, type: k, categoryId: '' }))
                }
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  form.type === k
                    ? k === 'income'
                      ? 'bg-white text-brand-income shadow-sm'
                      : 'bg-white text-brand-expense shadow-sm'
                    : 'text-brand-gray'
                }`}
              >
                {k === 'income' ? 'Receita' : 'Despesa'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Categoria
            </span>
            <select
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {categoryOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Status
            </span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as TransactionStatus,
                }))
              }
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TransactionStatusLabel[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-brand-moss/25 px-4 py-2 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
