import type {
  CategoryRuleRow,
  CategoryRuleInsert,
  PaymentMethod,
  RuleAction,
} from '../../lib/database.types';

export type { RuleAction };

/**
 * Regra de categorização definida pelo usuário. Casa por:
 *   - palavra na descrição (`keyword`), e/ou
 *   - valor do lançamento (`amount`, comparado pelo valor absoluto).
 *
 * Ação:
 *   - `categorize`: casou → aplica `categoryId`.
 *   - `ignore`: casou → ignora o lançamento (na importação) / exclui (histórico).
 */
export interface CategoryRule {
  id: string;
  /** Palavra na descrição ('' quando a regra é só por valor). */
  keyword: string;
  /** Valor exato do lançamento (null quando a regra é só por palavra). */
  amount: number | null;
  action: RuleAction;
  categoryId: string | null;
  /** Forma de movimentação a aplicar quando a regra casa (null = não define). */
  paymentMethod: PaymentMethod | null;
  createdAt: string;
}

export interface CategoryRuleInput {
  keyword?: string | null;
  amount?: number | null;
  action: RuleAction;
  categoryId?: string | null;
  paymentMethod?: PaymentMethod | null;
  createdBy?: string | null;
}

export const mapToCategoryRule = (row: CategoryRuleRow): CategoryRule => ({
  id: row.id,
  keyword: row.keyword ?? '',
  // PostgREST pode devolver numeric como string; normaliza p/ número (igual às
  // transações) para a comparação de valor da regra ser sempre numérica.
  amount: row.amount == null ? null : Number(row.amount),
  action: row.action,
  categoryId: row.category_id,
  // Tolerante à migração 0017 ainda não aplicada (coluna ausente → null).
  paymentMethod: row.payment_method ?? null,
  createdAt: row.created_at,
});

export const mapToCategoryRuleRow = (
  input: Partial<CategoryRuleInput>
): CategoryRuleInsert => {
  const row = {} as CategoryRuleInsert;
  if (input.keyword !== undefined) {
    const trimmed = input.keyword?.trim();
    row.keyword = trimmed ? trimmed : null;
  }
  if (input.amount !== undefined) row.amount = input.amount;
  if (input.action !== undefined) row.action = input.action;
  if (input.categoryId !== undefined) row.category_id = input.categoryId;
  if (input.paymentMethod !== undefined)
    row.payment_method = input.paymentMethod;
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  return row;
};

/** Rótulo curto da(s) condição(ões) da regra (ex.: "PIX", "R$ 133,43", "PIX + R$ 133,43"). */
export const ruleConditionLabel = (
  rule: Pick<CategoryRule, 'keyword' | 'amount'>,
  formatAmount: (value: number) => string
): string => {
  const parts: string[] = [];
  if (rule.keyword) parts.push(rule.keyword);
  if (rule.amount != null) parts.push(formatAmount(rule.amount));
  return parts.join(' + ');
};
