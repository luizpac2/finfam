import type {
  CategoryRuleRow,
  CategoryRuleInsert,
  RuleAction,
} from '../../lib/database.types';

export type { RuleAction };

/**
 * Regra de categorização por palavra-chave definida pelo usuário.
 *   - `categorize`: descrição contém `keyword` → aplica `categoryId`.
 *   - `ignore`: descrição contém `keyword` → ignora o lançamento na importação.
 */
export interface CategoryRule {
  id: string;
  keyword: string;
  action: RuleAction;
  categoryId: string | null;
  createdAt: string;
}

export interface CategoryRuleInput {
  keyword: string;
  action: RuleAction;
  categoryId?: string | null;
  createdBy?: string | null;
}

export const mapToCategoryRule = (row: CategoryRuleRow): CategoryRule => ({
  id: row.id,
  keyword: row.keyword,
  action: row.action,
  categoryId: row.category_id,
  createdAt: row.created_at,
});

export const mapToCategoryRuleRow = (
  input: Partial<CategoryRuleInput>
): CategoryRuleInsert => {
  const row = {} as CategoryRuleInsert;
  if (input.keyword !== undefined) row.keyword = input.keyword;
  if (input.action !== undefined) row.action = input.action;
  if (input.categoryId !== undefined) row.category_id = input.categoryId;
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  return row;
};
