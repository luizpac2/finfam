import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useReferenceData } from '../hooks/useReferenceData';
import { transactionService } from '../services';
import { parseStatementFile, type ParsedTransaction } from '../lib/fileParser';
import {
  isCardBillPayment,
  suggestCategoryId,
} from '../domain/categorizationEngine';
import { parseInstallment } from '../domain/installments';
import { applyUserRules, categoryKindMap } from '../domain/ruleEngine';
import type { TransactionType } from '../lib/database.types';
import {
  detectDuplicates,
  type DuplicateReason,
} from '../domain/duplicateDetection';
import { DragAndDropZone } from '../components/import/DragAndDropZone';
import {
  ReviewTransactions,
  type ReviewRow,
} from '../components/import/ReviewTransactions';

type Step = 'upload' | 'review';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Fluxo de importação de extratos:
 *   1. Upload (OFX/OFC/PDF) → parsing padronizado.
 *   2. Categorização automática (heurística) das linhas.
 *   3. Revisão/ajuste das categorias (ReviewTransactions).
 *   4. "Confirmar Importação" → batch insert no Supabase.
 */
export default function Import() {
  const { profile } = useAuth();
  const toast = useToast();

  const { categories, rules } = useReferenceData();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Extrato de cartão de crédito: liga o modo e escolhe de qual cartão.
  const [isCardStatement, setIsCardStatement] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');

  const cards = useMemo(
    () => categories.filter((c) => c.kind === 'credit_card'),
    [categories]
  );

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const parsed = await parseStatementFile(file);

      // Extrato de cartão: descobre qual SINAL representa as compras. A
      // convenção varia por emissor — em muitos CSV (ex.: Nubank) a compra vem
      // com valor POSITIVO; em OFX de cartão costuma ser NEGATIVO. Como as
      // compras são a maioria das linhas da fatura, o tipo dominante é "compra".
      const purchaseParsedType: TransactionType | null = isCardStatement
        ? (() => {
            const positives = parsed.filter((t) => t.type === 'income').length;
            return positives >= parsed.length - positives ? 'income' : 'expense';
          })()
        : null;

      // Tipo EFETIVO da linha (no modo cartão, a compra vira despesa). Usado na
      // detecção de duplicatas e na categorização.
      const effectiveTypeOf = (tx: ParsedTransaction): TransactionType =>
        isCardStatement
          ? tx.type === purchaseParsedType
            ? 'expense'
            : 'income'
          : tx.type;

      // Detecta duplicatas contra o que já está salvo nos meses do extrato,
      // usando o tipo EFETIVO (senão o sinal do cartão não casa com o salvo).
      let duplicates = new Map<number, DuplicateReason>();
      if (parsed.length > 0) {
        const dates = parsed.map((p) => p.date).sort();
        const from = `${dates[0].slice(0, 7)}-01`;
        const [ly, lm] = dates[dates.length - 1]
          .slice(0, 7)
          .split('-')
          .map(Number);
        const to = isoDate(new Date(ly, lm, 0)); // último dia do último mês
        try {
          const existing = await transactionService.list({ from, to });
          const dedupRows = parsed.map((tx) => ({
            ...tx,
            type: effectiveTypeOf(tx),
          }));
          duplicates = detectDuplicates(dedupRows, existing);
        } catch {
          /* se a checagem falhar, seguimos sem bloquear a importação */
        }
      }

      // Pré-categoriza cada linha; duplicatas/ignoradas entram desmarcadas.
      // Regras do usuário têm prioridade sobre a heurística.
      const kindById = categoryKindMap(categories);
      const reviewed: ReviewRow[] = parsed.map((tx, index) => {
        const duplicate = duplicates.get(index);
        const effectiveType = effectiveTypeOf(tx);
        const rule = applyUserRules(
          tx.description,
          tx.amount,
          effectiveType,
          rules,
          kindById
        );
        const ignored = rule.ignore || undefined;
        const installment = parseInstallment(tx.description) ?? undefined;

        // Extrato de cartão: a COMPRA (sinal dominante) vira despesa ligada ao
        // cartão. O outro sinal é o pagamento da própria fatura (excluído) ou um
        // estorno/reembolso (mantido) — distinguidos por palavra-chave.
        if (isCardStatement) {
          const isPurchase = tx.type === purchaseParsedType;
          if (isPurchase) {
            return {
              ...tx,
              type: 'expense',
              categoryId:
                rule.categoryId ??
                suggestCategoryId(tx.description, 'expense', categories),
              cardId: selectedCardId,
              installment,
              ignored,
              duplicate,
              include: !duplicate && !rule.ignore,
            };
          }
          const isPayment = isCardBillPayment(tx.description);
          return {
            ...tx,
            type: 'income',
            categoryId: '',
            cardId: isPayment ? undefined : selectedCardId,
            cardPayment: isPayment || undefined,
            cardCredit: !isPayment || undefined,
            installment,
            ignored,
            duplicate,
            include: !isPayment && !duplicate && !rule.ignore,
          };
        }

        return {
          ...tx,
          categoryId:
            rule.categoryId ??
            suggestCategoryId(tx.description, tx.type, categories),
          installment,
          ignored,
          duplicate,
          include: !duplicate && !rule.ignore,
        };
      });
      setRows(reviewed);
      setStep('review');

      const dupCount = duplicates.size;
      toast.success(
        `${parsed.length} lançamento(s) lido(s) de "${file.name}".` +
          (dupCount > 0 ? ` ${dupCount} possível(is) duplicata(s).` : '')
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleChangeRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Categorias são específicas por tipo: ao mudar o tipo, limpa a
        // categoria — a menos que a própria mudança já defina uma categoria
        // (ex.: escolher o tipo "Cartão de Crédito" já atribui o cartão).
        if (
          patch.type &&
          patch.type !== row.type &&
          patch.categoryId === undefined
        ) {
          next.categoryId = '';
        }
        return next;
      })
    );
  };

  // Reaplica regras + heurística nas linhas SEM categoria (preserva escolhas).
  const handleAutoCategorize = () => {
    let filled = 0;
    const kindById = categoryKindMap(categories);
    setRows((current) =>
      current.map((row) => {
        if (row.categoryId) return row;
        const rule = applyUserRules(
          row.description,
          row.amount,
          row.type,
          rules,
          kindById
        );
        const categoryId =
          rule.categoryId ??
          suggestCategoryId(row.description, row.type, categories);
        if (!categoryId) return row;
        filled += 1;
        return { ...row, categoryId };
      })
    );
    toast.success(
      filled > 0
        ? `${filled} lançamento(s) categorizados.`
        : 'Nada para categorizar automaticamente.'
    );
  };

  const handleRemoveRow = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
  };

  const handleSetAllIncluded = (include: boolean) => {
    setRows((current) => current.map((row) => ({ ...row, include })));
  };

  const reset = () => {
    setRows([]);
    setStep('upload');
    setIsCardStatement(false);
    setSelectedCardId('');
  };

  const handleConfirm = async () => {
    if (!profile) return;
    const toImport = rows.filter((row) => row.include);
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const count = await transactionService.createMany(
        toImport.map((row) => ({
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          status: 'pending',
          userId: profile.id,
          categoryId: row.categoryId || null,
          cardId: row.cardId || null,
        }))
      );
      toast.success(`${count} transação(ões) importada(s) com sucesso.`);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Importar extrato
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Envie um extrato (OFX, OFC, CSV, TXT ou PDF). As transações são
          categorizadas automaticamente e você revisa antes de salvar.
        </p>
      </header>

      {step === 'upload' ? (
        <div className="space-y-4">
          {/* Extrato de cartão de crédito */}
          <div className="rounded-2xl border border-brand-moss/10 bg-white p-4 shadow-card">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isCardStatement}
                onChange={(e) => {
                  setIsCardStatement(e.target.checked);
                  if (!e.target.checked) setSelectedCardId('');
                }}
                className="h-4 w-4 cursor-pointer accent-brand-aqua"
              />
              <span className="flex items-center gap-2 text-sm font-medium text-brand-moss">
                <CreditCard className="h-4 w-4 text-brand-aqua" strokeWidth={1.8} />
                Este é um extrato de cartão de crédito
              </span>
            </label>

            {isCardStatement && (
              <div className="mt-3 border-t border-brand-moss/10 pt-3">
                {cards.length === 0 ? (
                  <p className="text-sm text-brand-gray">
                    Nenhum cartão cadastrado. Cadastre um em{' '}
                    <Link
                      to="/categorias"
                      className="font-medium text-brand-moss underline"
                    >
                      Categorias
                    </Link>{' '}
                    (tipo Cartão de Crédito).
                  </p>
                ) : (
                  <label className="block max-w-xs">
                    <span className="mb-1 block text-sm font-medium text-brand-moss">
                      Qual cartão?
                    </span>
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-sm text-brand-moss outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/30"
                    >
                      <option value="">Selecione o cartão…</option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="mt-2 text-xs text-brand-gray">
                  As compras entram como despesas; o pagamento da própria fatura
                  é identificado e desmarcado automaticamente.
                </p>
              </div>
            )}
          </div>

          <DragAndDropZone
            onFileSelected={handleFile}
            disabled={parsing || (isCardStatement && !selectedCardId)}
            hint={
              parsing
                ? 'Lendo o arquivo…'
                : isCardStatement && !selectedCardId
                  ? 'Escolha o cartão para continuar'
                  : undefined
            }
          />
        </div>
      ) : (
        <ReviewTransactions
          rows={rows}
          categories={categories}
          submitting={importing}
          onChangeRow={handleChangeRow}
          onRemoveRow={handleRemoveRow}
          onSetAllIncluded={handleSetAllIncluded}
          onAutoCategorize={handleAutoCategorize}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}
    </div>
  );
}
