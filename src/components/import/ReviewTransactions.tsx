import { useMemo } from 'react';
import { Loader2, Sparkles, Trash2, X } from 'lucide-react';

import type { ParsedTransaction } from '../../lib/fileParser';
import {
  buildCategoryOptions,
  type Category,
} from '../../domain/entities/Category';
import type { TransactionType } from '../../lib/database.types';
import { formatCurrency } from '../../lib/format';
import { CategoryIcon } from '../../lib/categoryIcons';

/** Linha em revisão: transação importada + categoria escolhida (id ou ''). */
export interface ReviewRow extends ParsedTransaction {
  categoryId: string;
}

interface ReviewTransactionsProps {
  rows: ReviewRow[];
  categories: Category[];
  submitting: boolean;
  onChangeRow: (index: number, patch: Partial<ReviewRow>) => void;
  onRemoveRow: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const inputClass =
  'w-full rounded-lg border border-brand-moss/25 bg-white px-2 py-1.5 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30';

/**
 * Tela de revisão (DataGrid) das transações importadas — totalmente editável.
 * A categoria é filtrada pelo tipo da linha (receita/despesa) e mostra
 * subcategorias indentadas.
 */
export function ReviewTransactions({
  rows,
  categories,
  submitting,
  onChangeRow,
  onRemoveRow,
  onConfirm,
  onCancel,
}: ReviewTransactionsProps) {
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

  const optionsByKind = useMemo(
    () => ({
      income: buildCategoryOptions(categories, 'income'),
      expense: buildCategoryOptions(categories, 'expense'),
    }),
    [categories]
  );

  const stats = useMemo(() => {
    const categorized = rows.filter((row) => row.categoryId !== '').length;
    const totals = rows.reduce(
      (acc, row) => {
        if (row.type === 'income') acc.income += row.amount;
        else acc.expense += row.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
    return { categorized, ...totals };
  }, [rows]);

  return (
    <section className="rounded-2xl border border-brand-moss/10 bg-white shadow-card">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-moss/10 px-4 py-3">
        <div className="flex items-center gap-2 text-brand-moss">
          <Sparkles className="h-5 w-5 text-brand-aqua" strokeWidth={1.8} />
          <span className="font-semibold">Revisar e categorizar</span>
          <span className="text-sm text-brand-gray">
            · {stats.categorized}/{rows.length} categorizadas
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-brand-aqua">+ {formatCurrency(stats.income)}</span>
          <span className="text-brand-moss">− {formatCurrency(stats.expense)}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-brand-gray">
          Nenhuma linha para importar. Cancele para começar de novo.
        </p>
      ) : (
        <div className="max-h-[calc(100vh-19rem)] overflow-auto">
          <table className="border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-moss/10">
              {rows.map((row, index) => {
                const selected = categoryById.get(row.categoryId);
                return (
                  <tr key={index} className="hover:bg-brand-light/50">
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={row.date}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, { date: e.target.value })
                        }
                        className={`${inputClass} w-[8.5rem]`}
                        aria-label="Data"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.description}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, { description: e.target.value })
                        }
                        className={`${inputClass} w-[22rem]`}
                        aria-label="Descrição"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={row.type}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, {
                            type: e.target.value as TransactionType,
                          })
                        }
                        className={`${inputClass} w-[6.5rem] ${
                          row.type === 'income'
                            ? 'text-brand-aqua'
                            : 'text-brand-moss'
                        }`}
                        aria-label="Tipo"
                      >
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: `${selected?.color ?? '#D8D8D8'}33`,
                          }}
                        >
                          <CategoryIcon
                            name={selected?.icon}
                            className="h-3.5 w-3.5"
                          />
                        </span>
                        <select
                          value={row.categoryId}
                          disabled={submitting}
                          onChange={(e) =>
                            onChangeRow(index, { categoryId: e.target.value })
                          }
                          className={`${inputClass} w-[15rem]`}
                          aria-label="Categoria"
                        >
                          <option value="">Sem categoria</option>
                          {optionsByKind[row.type].map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, {
                            amount: Math.abs(Number(e.target.value)) || 0,
                          })
                        }
                        className={`${inputClass} w-[7rem] text-right font-medium ${
                          row.type === 'income'
                            ? 'text-brand-aqua'
                            : 'text-brand-moss'
                        }`}
                        aria-label="Valor"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveRow(index)}
                        disabled={submitting}
                        className="rounded-lg p-1.5 text-brand-gray transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Remover linha"
                        title="Remover linha"
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

      {/* Rodapé / ações */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-brand-moss/10 px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-moss/25 px-4 py-2 text-sm font-medium text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting || rows.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Importando…' : `Confirmar importação (${rows.length})`}
        </button>
      </div>
    </section>
  );
}
