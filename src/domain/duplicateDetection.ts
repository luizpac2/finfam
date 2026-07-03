import type { ParsedTransaction } from '../lib/fileParser';
import type { TransactionType } from '../lib/database.types';

/**
 * Detecção de lançamentos duplicados na importação de extratos.
 *
 * Como os extratos não trazem um identificador único confiável, comparamos por
 * "assinatura": mês + descrição normalizada + valor + tipo. A granularidade de
 * MÊS (e não do dia exato) atende ao requisito de alertar sobre "lançamentos
 * repetidos no mesmo mês", tolerando pequenas diferenças de data de postagem.
 */

/** Campos mínimos para gerar a assinatura de um lançamento. */
export interface SignatureInput {
  date: string; // ISO (YYYY-MM-DD)
  description: string;
  amount: number;
  type: TransactionType;
}

/** Motivo de uma linha ter sido marcada como duplicada. */
export type DuplicateReason =
  | 'existing' // já existe um lançamento salvo no mesmo mês
  | 'file'; // repetido dentro do próprio arquivo importado

/** Gera a assinatura estável de um lançamento (mês|descrição|valor|tipo). */
export const transactionSignature = (tx: SignatureInput): string => {
  const month = tx.date.slice(0, 7); // YYYY-MM
  const description = tx.description.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${month}|${description}|${tx.amount.toFixed(2)}|${tx.type}`;
};

/**
 * Marca duplicatas entre as linhas importadas.
 * @param rows Linhas lidas do extrato (na ordem original).
 * @param existing Lançamentos já salvos no período (para comparação).
 * @returns Mapa índice-da-linha → motivo, apenas para as linhas duplicadas.
 */
export const detectDuplicates = (
  rows: ParsedTransaction[],
  existing: SignatureInput[]
): Map<number, DuplicateReason> => {
  const existingSet = new Set(existing.map(transactionSignature));
  const seenInFile = new Set<string>();
  const result = new Map<number, DuplicateReason>();

  rows.forEach((row, index) => {
    const signature = transactionSignature(row);
    if (existingSet.has(signature)) {
      result.set(index, 'existing');
    } else if (seenInFile.has(signature)) {
      result.set(index, 'file');
    }
    seenInFile.add(signature);
  });

  return result;
};
