import { supabase } from '../lib/supabaseClient';
import {
  mapToCategoryRule,
  mapToCategoryRuleRow,
  type CategoryRule,
  type CategoryRuleInput,
} from '../domain/entities/CategoryRule';
import { unwrap } from './serviceError';

const TABLE = 'category_rules';

/** Erro do PostgREST de coluna `payment_method` ausente (migração 0017 pendente). */
const isMissingPaymentColumn = (
  error: { message?: string; details?: string; hint?: string } | null
): boolean =>
  !!error &&
  /payment_method/i.test(
    `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  );

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
    const payload = mapToCategoryRuleRow(input);
    const run = (p: typeof payload) =>
      supabase.from(TABLE).insert(p).select().single();

    // Tolerante à migração 0017 pendente: reenvia sem `payment_method`.
    let res = await run(payload);
    if (res.error && 'payment_method' in payload && isMissingPaymentColumn(res.error)) {
      const fallback = { ...payload };
      delete fallback.payment_method;
      res = await run(fallback);
    }
    const row = unwrap(res, 'criar a regra');
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
