import type { CategoryRow, CategoryUpdate } from '../../lib/database.types';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: string;
}

export interface CategoryInput {
  name: string;
  icon?: string | null;
  color?: string | null;
}

/** Mapeia uma linha da tabela `categories` para a entidade de domínio. */
export const mapToCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  createdAt: row.created_at,
});

/** Converte a entidade de domínio (parcial) para o formato da tabela. */
export const mapToCategoryRow = (
  input: Partial<CategoryInput>
): CategoryUpdate => {
  const row: CategoryUpdate = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.icon !== undefined) row.icon = input.icon;
  if (input.color !== undefined) row.color = input.color;
  return row;
};
