import { supabase } from '../lib/supabaseClient';
import {
  mapToCategory,
  mapToCategoryRow,
  type Category,
  type CategoryInput,
} from '../domain/entities/Category';
import { unwrap } from './serviceError';

const TABLE = 'categories';

/** Erro do PostgREST de coluna `closed_registered_at` ausente (migração 0018 pendente). */
const isMissingClosedRegisteredColumn = (
  error: { message?: string; details?: string; hint?: string } | null
): boolean =>
  !!error &&
  /closed_registered_at/i.test(
    `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  );

/**
 * Serviço de acesso à tabela `categories`.
 * Retorna entidades de domínio (camelCase), nunca linhas cruas.
 */
export const categoryService = {
  /** Lista todas as categorias, ordenadas por nome. */
  async list(): Promise<Category[]> {
    const rows = unwrap(
      await supabase.from(TABLE).select('*').order('name', { ascending: true }),
      'listar as categorias'
    );
    return rows.map(mapToCategory);
  },

  /** Busca uma categoria por id. */
  async getById(id: string): Promise<Category> {
    const row = unwrap(
      await supabase.from(TABLE).select('*').eq('id', id).single(),
      'carregar a categoria'
    );
    return mapToCategory(row);
  },

  /** Cria uma categoria (restrito a admins por RLS). */
  async create(input: CategoryInput): Promise<Category> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .insert({
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          kind: input.kind ?? 'expense',
          parent_id: input.parentId ?? null,
        })
        .select()
        .single(),
      'criar a categoria'
    );
    return mapToCategory(row);
  },

  /** Atualiza uma categoria existente (restrito a admins por RLS). */
  async update(id: string, input: Partial<CategoryInput>): Promise<Category> {
    const payload = mapToCategoryRow(input);
    const run = (p: typeof payload) =>
      supabase.from(TABLE).update(p).eq('id', id).select().single();

    // Tolerante à migração 0018 pendente: reenvia sem `closed_registered_at`,
    // para o cancelamento do cartão não falhar (só fica sem o dia/hora).
    let res = await run(payload);
    if (
      res.error &&
      'closed_registered_at' in payload &&
      isMissingClosedRegisteredColumn(res.error)
    ) {
      const fallback = { ...payload };
      delete fallback.closed_registered_at;
      res = await run(fallback);
    }

    const row = unwrap(res, 'atualizar a categoria');
    return mapToCategory(row);
  },

  /** Remove uma categoria (restrito a admins por RLS). */
  async remove(id: string): Promise<void> {
    unwrap(
      await supabase.from(TABLE).delete().eq('id', id),
      'excluir a categoria'
    );
  },
};
