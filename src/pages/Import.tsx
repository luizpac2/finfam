import { useEffect, useState } from 'react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { categoryService, transactionService } from '../services';
import type { Category } from '../domain/entities/Category';
import { parseStatementFile } from '../lib/fileParser';
import { suggestCategoryId } from '../domain/categorizationEngine';
import { DragAndDropZone } from '../components/import/DragAndDropZone';
import {
  ReviewTransactions,
  type ReviewRow,
} from '../components/import/ReviewTransactions';

type Step = 'upload' | 'review';

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
      // Pré-categoriza cada linha com a heurística.
      const reviewed: ReviewRow[] = parsed.map((tx) => ({
        ...tx,
        categoryId: suggestCategoryId(tx.description, tx.type, categories),
      }));
      setRows(reviewed);
      setStep('review');
      toast.success(`${parsed.length} lançamento(s) lido(s) de "${file.name}".`);
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
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleRemoveRow = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
  };

  const reset = () => {
    setRows([]);
    setStep('upload');
  };

  const handleConfirm = async () => {
    if (!profile || rows.length === 0) return;
    setImporting(true);
    try {
      const count = await transactionService.createMany(
        rows.map((row) => ({
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          status: 'pending',
          userId: profile.id,
          categoryId: row.categoryId || null,
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
        <DragAndDropZone
          onFileSelected={handleFile}
          disabled={parsing}
          hint={parsing ? 'Lendo o arquivo…' : undefined}
        />
      ) : (
        <ReviewTransactions
          rows={rows}
          categories={categories}
          submitting={importing}
          onChangeRow={handleChangeRow}
          onRemoveRow={handleRemoveRow}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}
    </div>
  );
}
