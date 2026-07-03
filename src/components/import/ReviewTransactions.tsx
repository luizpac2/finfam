import { useMemo } from 'react';
import { AlertTriangle, Loader2, Sparkles, Trash2, Wand2, X } from 'lucide-react';

import type { ParsedTransaction } from '../../lib/fileParser';
import {
  buildCategoryOptions,
  type Category,
} from '../../domain/entities/Category';
import type { DuplicateReason } from '../../domain/duplicateDetection';
import { isCardRefund } from '../../domain/categorizationEngine';
import type { TransactionType } from '../../lib/database.types';
import { formatCurrencyAccounting } from '../../lib/format';
import { CategorySelect } from '../ui/CategorySelect';

/** Linha em revisão: transação importada + categoria escolhida (id ou ''). */
export interface ReviewRow extends ParsedTransaction {
  categoryId: string;
  /** Se será realmente importada (duplicatas vêm desmarcadas por padrão). */
  include: boolean;
  /** Preenchido quando a linha parece duplicada. */
  duplicate?: DuplicateReason;
  /** Cartão ao qual a compra pertence (importação de extrato de cartão). */
  cardId?: string;
  /** Linha do pagamento da própria fatura — excluída por padrão. */
  cardPayment?: boolean;
  /** Crédito no cartão que NÃO é pagamento (estorno/reembolso) — mantido. */
  cardCredit?: boolean;
  /** Casou com uma regra de "ignorar" — desmarcada por padrão. */
  ignored?: boolean;
}

interface ReviewTransactionsProps {
  rows: ReviewRow[];
  categories: Category[];
  submitting: boolean;
  onChangeRow: (index: number, patch: Partial<ReviewRow>) => void;
  onRemoveRow: (index: number) => void;
  onSetAllIncluded: (include: boolean) => void;
  onAutoCategorize: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const duplicateBadge: Record<DuplicateReason, string> = {
  existing: 'Já existe',
  file: 'Repetido',
};

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
  onSetAllIncluded,
  onAutoCategorize,
  onConfirm,
  onCancel,
}: ReviewTransactionsProps) {
  const optionsByKind = useMemo(
    () => ({
      income: buildCategoryOptions(categories, 'income'),
      expense: buildCategoryOptions(categories, 'expense'),
      credit_card: buildCategoryOptions(categories, 'credit_card'),
    }),
    [categories]
  );

  // Ids das categorias de cartão — usados para exibir "Cartão de Crédito" como
  // uma opção na coluna Tipo (mesmo o lançamento sendo, no fundo, uma despesa).
  const cardIds = useMemo(
    () => new Set(optionsByKind.credit_card.map((o) => o.id)),
    [optionsByKind]
  );
  const hasCards = optionsByKind.credit_card.length > 0;

  const stats = useMemo(() => {
    const included = rows.filter((row) => row.include);
    const categorized = rows.filter((row) => row.categoryId !== '').length;
    const duplicates = rows.filter((row) => row.duplicate);
    const existingDupes = duplicates.filter(
      (row) => row.duplicate === 'existing'
    ).length;
    const totals = included.reduce(
      (acc, row) => {
        if (row.type === 'income') acc.income += row.amount;
        else acc.expense += row.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
    return {
      categorized,
      includedCount: included.length,
      duplicateCount: duplicates.length,
      existingDupes,
      cardPaymentCount: rows.filter((row) => row.cardPayment).length,
      ignoredCount: rows.filter((row) => row.ignored).length,
      allExistingDupes:
        rows.length > 0 && existingDupes === rows.length,
      allIncluded: rows.length > 0 && included.length === rows.length,
      ...totals,
    };
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
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
          <button
            type="button"
            onClick={onAutoCategorize}
            disabled={submitting}
            title="Preenche as categorias vazias pelas regras e pela descrição"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-moss/25 px-3 py-1.5 text-brand-moss transition hover:bg-brand-light disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            Categorizar automaticamente
          </button>
          <span className="text-brand-income">
            {formatCurrencyAccounting(stats.income)}
          </span>
          <span className="text-brand-expense">
            {formatCurrencyAccounting(-stats.expense)}
          </span>
        </div>
      </div>

      {/* Alerta de duplicatas */}
      {stats.duplicateCount > 0 && (
        <div className="flex items-start gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.8} />
          <div>
            {stats.allExistingDupes ? (
              <p className="font-semibold">
                Este extrato parece já ter sido importado: todos os{' '}
                {rows.length} lançamentos já existem neste mês.
              </p>
            ) : (
              <p className="font-semibold">
                {stats.duplicateCount} lançamento(s) parecem duplicados
                {stats.existingDupes > 0 &&
                  ` (${stats.existingDupes} já existem neste mês)`}
                .
              </p>
            )}
            <p className="mt-0.5 text-amber-700">
              Eles vêm <strong>desmarcados</strong> por segurança. Marque a
              caixa da linha se quiser importar mesmo assim.
            </p>
          </div>
        </div>
      )}

      {/* Aviso: lançamentos ignorados por regra do usuário */}
      {stats.ignoredCount > 0 && (
        <div className="border-b border-brand-moss/10 bg-brand-light px-4 py-2.5 text-sm text-brand-gray">
          {stats.ignoredCount} lançamento(s) desmarcados por uma{' '}
          <strong className="text-brand-moss">regra de ignorar</strong>. Marque
          a caixa se quiser importar mesmo assim.
        </div>
      )}

      {/* Aviso: pagamento(s) da própria fatura, excluído(s) por padrão */}
      {stats.cardPaymentCount > 0 && (
        <div className="border-b border-brand-moss/10 bg-brand-light px-4 py-2.5 text-sm text-brand-gray">
          {stats.cardPaymentCount} lançamento(s) identificados como{' '}
          <strong className="text-brand-moss">pagamento da fatura</strong> do
          cartão foram desmarcados (não são despesas).
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-brand-gray">
          Nenhuma linha para importar. Cancele para começar de novo.
        </p>
      ) : (
        <div className="max-h-[calc(100vh-19rem)] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
              <tr>
                <th className="w-[2.5rem] px-2 py-2">
                  <input
                    type="checkbox"
                    checked={stats.allIncluded}
                    onChange={(e) => onSetAllIncluded(e.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 cursor-pointer accent-brand-aqua"
                    aria-label="Incluir todos"
                  />
                </th>
                <th className="w-[9.5rem] px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="w-[11rem] px-3 py-2 font-medium">Tipo</th>
                <th className="w-[17rem] px-3 py-2 font-medium">Categoria</th>
                <th className="w-[8.5rem] px-3 py-2 text-right font-medium">Valor</th>
                <th className="w-[3.5rem] px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-moss/10">
              {rows.map((row, index) => {
                const isDup = Boolean(row.duplicate);
                const flagged = isDup || row.cardPayment || row.ignored;
                return (
                  <tr
                    key={index}
                    className={
                      flagged
                        ? 'bg-amber-50/70 hover:bg-amber-50'
                        : 'hover:bg-brand-light/50'
                    }
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.include}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, { include: e.target.checked })
                        }
                        className="h-4 w-4 cursor-pointer accent-brand-aqua"
                        aria-label="Incluir na importação"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        value={row.date}
                        disabled={submitting}
                        onChange={(e) =>
                          onChangeRow(index, { date: e.target.value })
                        }
                        className={inputClass}
                        aria-label="Data"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        {row.ignored && (
                          <span className="shrink-0 rounded-full bg-brand-gray/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                            Ignorado
                          </span>
                        )}
                        {row.cardPayment && (
                          <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Pgto fatura
                          </span>
                        )}
                        {row.cardCredit && (
                          <span className="shrink-0 rounded-full bg-brand-aqua/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-moss">
                            {isCardRefund(row.description) ? 'Estorno' : 'Crédito'}
                          </span>
                        )}
                        {isDup && (
                          <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            {duplicateBadge[row.duplicate!]}
                          </span>
                        )}
                        <input
                          type="text"
                          value={row.description}
                          disabled={submitting}
                          onChange={(e) =>
                            onChangeRow(index, { description: e.target.value })
                          }
                          className={inputClass}
                          aria-label="Descrição"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={cardIds.has(row.categoryId) ? 'card' : row.type}
                        disabled={submitting}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'card') {
                            // "Cartão de Crédito": vira despesa e recebe a
                            // categoria do cartão (mantém se já for um cartão).
                            const cardId = cardIds.has(row.categoryId)
                              ? row.categoryId
                              : optionsByKind.credit_card[0]?.id ?? '';
                            onChangeRow(index, {
                              type: 'expense',
                              categoryId: cardId,
                            });
                          } else {
                            onChangeRow(index, {
                              type: v as TransactionType,
                              categoryId: '',
                            });
                          }
                        }}
                        className={`${inputClass} ${
                          cardIds.has(row.categoryId)
                            ? 'text-brand-moss'
                            : row.type === 'income'
                              ? 'text-brand-income'
                              : 'text-brand-expense'
                        }`}
                        aria-label="Tipo"
                      >
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                        {hasCards && (
                          <option value="card">Cartão de Crédito</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <CategorySelect
                        value={row.categoryId}
                        onChange={(v) => onChangeRow(index, { categoryId: v })}
                        categories={categories}
                        kinds={
                          row.type === 'income'
                            ? ['income']
                            : ['expense', 'credit_card']
                        }
                        emptyOption={{ value: '', label: 'Sem categoria' }}
                        placeholder="Sem categoria"
                        disabled={submitting}
                        ariaLabel="Categoria"
                      />
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
                        className={`${inputClass} text-right font-medium ${
                          row.type === 'income'
                            ? 'text-brand-income'
                            : 'text-brand-expense'
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
          disabled={submitting || stats.includedCount === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-aqua px-5 py-2 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? 'Importando…'
            : `Confirmar importação (${stats.includedCount})`}
        </button>
      </div>
    </section>
  );
}
