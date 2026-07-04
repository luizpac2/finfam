import { supabase } from '../lib/supabaseClient';
import {
  mapToCategoryRule,
  mapToCategoryRuleRow,
  type CategoryRule,
  type CategoryRuleInput,
} from '../domain/entities/CategoryRule';
import { unwrap } from './serviceError';

const TABLE = 'category_rules';

/**
 * Serviço das regras de categorização por palavra-chave.
 * Leitura para membros ativos; escrita restrita a admins (via RLS).
 */
export const categoryRuleService = {
  /**
   * Lista as regras, das mais específicas para as mais genéricas.
   * Especificidade: regras com valor pesam mais; depois, palavra mais longa.
   */
  async list(): Promise<CategoryRule[]> {
    const rows = unwrap(
      await supabase.from(TABLE).select('*').order('created_at', { ascending: true }),
      'listar as regras'
    );
    const specificity = (r: CategoryRule) =>
      (r.amount != null ? 1000 : 0) + r.keyword.length;
    return rows
      .map(mapToCategoryRule)
      .sort((a, b) => specificity(b) - specificity(a));
  },

  /** Cria uma regra (restrito a admins por RLS). */
  async create(input: CategoryRuleInput): Promise<CategoryRule> {
    const row = unwrap(
      await supabase
        .from(TABLE)
        .insert(mapToCategoryRuleRow(input))
        .select()
        .single(),
      'criar a regra'
    );
    return mapToCategoryRule(row);
  },

  /** Remove uma regra (restrito a admins por RLS). */
  async remove(id: string): Promise<void> {
    unwrap(
      await supabase.from(TABLE).delete().eq('id', id),
      'excluir a regra'
    );
  },
};
