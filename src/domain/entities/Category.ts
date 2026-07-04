import type {
  CategoryKind,
  CategoryRow,
  CategoryUpdate,
} from '../../lib/database.types';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: CategoryKind;
  parentId: string | null;
  createdAt: string;
}

export interface CategoryInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  kind?: CategoryKind;
  parentId?: string | null;
}

/** Mapeia uma linha da tabela `categories` para a entidade de domínio. */
export const mapToCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  kind: row.kind,
  parentId: row.parent_id,
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
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.parentId !== undefined) row.parent_id = input.parentId;
  return row;
};

export interface CategoryOption {
  id: string;
  /** Rótulo já com indentação para subcategorias. */
  label: string;
  depth: number;
}

/**
 * Expande uma seleção de categorias para incluir as subcategorias: ao escolher
 * uma categoria-pai, os lançamentos das suas subcategorias também entram no
 * filtro. Selecionar uma subcategoria continua valendo só para ela.
 */
export const expandCategorySelection = (
  selected: Set<string>,
  categories: Category[]
): Set<string> => {
  if (selected.size === 0) return selected;
  const out = new Set(selected);
  for (const c of categories) {
    if (c.parentId && selected.has(c.parentId)) out.add(c.id);
  }
  return out;
};

/** Slug legível para URLs (ex.: "Energia Elétrica" → "energia-eletrica"). */
export const categorySlug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'pt-BR');

/**
 * Monta opções (categoria pai → subcategorias indentadas) para dropdowns,
 * opcionalmente filtrando por tipo (receita/despesa).
 */
export const buildCategoryOptions = (
  categories: Category[],
  kind?: CategoryKind
): CategoryOption[] => {
  const scoped = kind ? categories.filter((c) => c.kind === kind) : categories;
  const roots = scoped.filter((c) => !c.parentId).sort(byName);
  const options: CategoryOption[] = [];

  for (const root of roots) {
    options.push({ id: root.id, label: root.name, depth: 0 });
    const children = scoped
      .filter((c) => c.parentId === root.id)
      .sort(byName);
    for (const child of children) {
      options.push({ id: child.id, label: `↳ ${child.name}`, depth: 1 });
    }
  }
  return options;
};
