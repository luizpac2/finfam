import { useMemo } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';

import type { ParsedTransaction } from '../../lib/fileParser';
import type { Category } from '../../domain/entities/Category';
import { formatCurrency, formatDate } from '../../lib/format';
import { TransactionTypeLabel } from '../../domain/constants';

/** Linha em revisão: transação importada + categoria escolhida (id ou ''). */
export interface ReviewRow extends ParsedTransaction {
  categoryId: string;
}

interface ReviewTransactionsProps {
  rows: ReviewRow[];
  categories: Category[];
  submitting: boolean;
  onChangeCategory: (index: number, categoryId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Tela de revisão (DataGrid) das transações importadas.
 * Mostra cada lançamento com a categoria pré-selecionada pela heurística,
 * permitindo ajustar via dropdown antes de confirmar a importação.
 */
export function ReviewTransactions({
  rows,
  categories,
  submitting,
  onChangeCategory,
  onConfirm,
  onCancel,
}: ReviewTransactionsProps) {
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

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
      {/* Cabeçalho do grid */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-moss/10 px-4 py-4">
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

      {/* Grid */}
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-moss/10">
            {rows.map((row, index) => {
              const selected = categoryById.get(row.categoryId);
              return (
                <tr
                  key={`${row.date}-${index}`}
                  className="text-brand-moss transition hover:bg-brand-light/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-brand-gray">
                    {formatDate(row.date)}
                  </td>
                  <td className="max-w-[18rem] truncate px-4 py-3" title={row.description}>
                    {row.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.type === 'income'
                          ? 'bg-brand-aqua/20 text-brand-moss'
                          : 'bg-brand-moss/10 text-brand-moss'
                      }`}
                    >
                      {TransactionTypeLabel[row.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-brand-moss/10"
                        style={{ backgroundColor: selected?.color ?? '#D8D8D8' }}
                      />
                      <select
                        value={row.categoryId}
                        disabled={submitting}
                        onChange={(event) =>
                          onChangeCategory(index, event.target.value)
                        }
                        className="max-w-[12rem] rounded-lg border border-brand-moss/25 bg-white px-2 py-1.5 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30 disabled:opacity-60"
                        aria-label={`Categoria de ${row.description}`}
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                      row.type === 'income' ? 'text-brand-aqua' : 'text-brand-moss'
                    }`}
                  >
                    {row.type === 'income' ? '+' : '−'} {formatCurrency(row.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé / ações */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-brand-moss/10 px-4 py-4">
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
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? 'Importando…'
            : `Confirmar importação (${rows.length})`}
        </button>
      </div>
    </section>
  );
}
