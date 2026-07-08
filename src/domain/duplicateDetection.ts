import type { ParsedTransaction } from '../lib/fileParser';
import type { TransactionType } from '../lib/database.types';

/**
 * Detecção de lançamentos duplicados na importação de extratos.
 *
 * Duas verificações com granularidades diferentes:
 *  - **existing** (já salvo no banco): assinatura por MÊS + descrição + valor +
 *    tipo. Granularidade de mês tolera pequenas diferenças de data de postagem
 *    ao reimportar o mesmo extrato.
 *  - **file** (repetido no próprio arquivo): assinatura pelo DIA EXATO. Assim,
 *    duas compras iguais no mesmo estabelecimento em dias diferentes NÃO são
 *    tratadas como repetição (evita falsos positivos comuns em cartão).
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
  | 'file'; // repetido (mesmo dia) dentro do próprio arquivo importado

const normDesc = (d: string) => d.trim().toLowerCase().replace(/\s+/g, ' ');

/** Assinatura por MÊS (para comparar com o que já está salvo no banco). */
export const monthSignature = (tx: SignatureInput): string =>
  `${tx.date.slice(0, 7)}|${normDesc(tx.description)}|${tx.amount.toFixed(2)}|${tx.type}`;

/** Assinatura pelo DIA EXATO (para repetição dentro do mesmo arquivo). */
export const daySignature = (tx: SignatureInput): string =>
  `${tx.date}|${normDesc(tx.description)}|${tx.amount.toFixed(2)}|${tx.type}`;

/**
 * Marca duplicatas entre as linhas importadas.
 * @param rows Linhas lidas do extrato (na ordem original). Use o tipo EFETIVO
 *   (no modo cartão, a compra é despesa) para casar com o que foi salvo.
 * @param existing Lançamentos já salvos no período (para comparação).
 * @returns Mapa índice-da-linha → motivo, apenas para as linhas duplicadas.
 */
export const detectDuplicates = (
  rows: ParsedTransaction[],
  existing: SignatureInput[]
): Map<number, DuplicateReason> => {
  const existingSet = new Set(existing.map(monthSignature));
  const seenInFile = new Set<string>();
  const result = new Map<number, DuplicateReason>();

  rows.forEach((row, index) => {
    if (existingSet.has(monthSignature(row))) {
      result.set(index, 'existing');
    } else if (seenInFile.has(daySignature(row))) {
      result.set(index, 'file');
    }
    seenInFile.add(daySignature(row));
  });

  return result;
};
