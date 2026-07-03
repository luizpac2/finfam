import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { categoryService, transactionService } from '../services';
import type { Category } from '../domain/entities/Category';
import { parseStatementFile } from '../lib/fileParser';
import { suggestCategoryId } from '../domain/categorizationEngine';
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

  const [categories, setCategories] = useState<Category[]>([]);
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

  // Carrega as categorias para alimentar a inferência e os dropdowns.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await categoryService.list();
        if (active) setCategories(list);
      } catch {
        if (active) {
          toast.error('Não foi possível carregar as categorias.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const parsed = await parseStatementFile(file);

      // Detecta duplicatas contra o que já está salvo nos meses do extrato
      // (extrato repetido / lançamentos repetidos no mesmo mês).
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
          duplicates = detectDuplicates(parsed, existing);
        } catch {
          /* se a checagem falhar, seguimos sem bloquear a importação */
        }
      }

      // Pré-categoriza cada linha; duplicatas entram desmarcadas.
      const reviewed: ReviewRow[] = parsed.map((tx, index) => {
        const duplicate = duplicates.get(index);

        // Extrato de cartão: as compras (débitos) viram despesas ligadas ao
        // cartão; as entradas (créditos) são o pagamento da própria fatura e
        // ficam desmarcadas.
        if (isCardStatement) {
          const isPayment = tx.type === 'income';
          return {
            ...tx,
            categoryId: isPayment
              ? ''
              : suggestCategoryId(tx.description, 'expense', categories),
            cardId: isPayment ? undefined : selectedCardId,
            cardPayment: isPayment || undefined,
            duplicate,
            include: !isPayment && !duplicate,
          };
        }

        return {
          ...tx,
          categoryId: suggestCategoryId(tx.description, tx.type, categories),
          duplicate,
          include: !duplicate,
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
        // Categorias são específicas por tipo: ao mudar o tipo, limpa a categoria.
        if (patch.type && patch.type !== row.type) next.categoryId = '';
        return next;
      })
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
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}
    </div>
  );
}
