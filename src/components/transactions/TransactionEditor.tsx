import { useMemo, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { CategorySelect } from '../ui/CategorySelect';
import type { Category } from '../../domain/entities/Category';
import type { Transaction } from '../../domain/entities/Transaction';
import type { TransactionType } from '../../lib/database.types';

export interface TransactionFormValues {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  /** Cartão da compra (forma de pagamento); '' = outra forma (transferência…). */
  cardId: string;
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
    cardId: initial?.cardId ?? '',
  }));

  // Cartões (categorias tipo credit_card) — para oferecer "Cartão" no seletor
  // de Tipo. Marcar como Cartão = despesa cuja categoria é o cartão.
  const cardIds = useMemo(
    () => new Set(categories.filter((c) => c.kind === 'credit_card').map((c) => c.id)),
    [categories]
  );
  const firstCardId = useMemo(
    () => categories.find((c) => c.kind === 'credit_card')?.id ?? '',
    [categories]
  );
  const cards = useMemo(
    () => categories.filter((c) => c.kind === 'credit_card'),
    [categories]
  );
  const hasCards = cardIds.size > 0;
  const activeTipo: 'income' | 'expense' | 'card' = cardIds.has(form.categoryId)
    ? 'card'
    : form.type;

  const setTipo = (v: 'income' | 'expense' | 'card') => {
    if (v === 'card') {
      setForm((f) => ({
        ...f,
        type: 'expense',
        categoryId: cardIds.has(f.categoryId) ? f.categoryId : firstCardId,
      }));
    } else {
      setForm((f) => ({ ...f, type: v, categoryId: '' }));
    }
  };

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
      // Só despesas "normais" têm cartão da compra (não em receita/pagto fatura).
      cardId: activeTipo === 'expense' ? form.cardId : '',
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
          <div
            className={`grid gap-1 rounded-lg bg-brand-light p-1 ${
              hasCards ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {(
              [
                ['income', 'Receita', 'text-brand-income'],
                ['expense', 'Despesa', 'text-brand-expense'],
                ...(hasCards
                  ? [['card', 'Cartão', 'text-brand-moss'] as const]
                  : []),
              ] as [typeof activeTipo, string, string][]
            ).map(([value, label, activeColor]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTipo(value)}
                className={`rounded-md px-1 py-1.5 text-sm font-medium transition ${
                  activeTipo === value
                    ? `bg-white shadow-sm ${activeColor}`
                    : 'text-brand-gray'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-brand-moss">
            Categoria
          </span>
          <CategorySelect
            value={form.categoryId}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            categories={categories}
            kinds={
              form.type === 'income' ? ['income'] : ['expense', 'credit_card']
            }
            emptyOption={{ value: '', label: 'Sem categoria' }}
            placeholder="Sem categoria"
            className="py-2"
          />
        </label>

        {/* Forma de pagamento (cartão da compra) — só para despesas normais. */}
        {activeTipo === 'expense' && hasCards && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-brand-moss">
              Forma de pagamento
            </span>
            <select
              value={form.cardId}
              onChange={(e) =>
                setForm((f) => ({ ...f, cardId: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">Outra (transferência, boleto…)</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
