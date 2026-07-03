import type { CategoryRule } from './entities/CategoryRule';
import { normalizeText } from './categorizationEngine';

/**
 * Aplica as regras do usuário a uma descrição.
 *
 * Uma regra casa quando a `keyword` (normalizada — sem acento, maiúsculas)
 * aparece na descrição. Regras de "ignore" têm precedência: se qualquer uma
 * casar, o lançamento é ignorado. Para "categorize", vale a PRIMEIRA regra que
 * casa (a ordem vem da listagem — regras mais específicas primeiro).
 */
export const applyUserRules = (
  description: string,
  rules: CategoryRule[]
): { ignore: boolean; categoryId: string | null } => {
  const text = normalizeText(description);
  if (!text) return { ignore: false, categoryId: null };

  let categoryId: string | null = null;
  let ignore = false;

  for (const rule of rules) {
    const keyword = normalizeText(rule.keyword);
    if (!keyword || !text.includes(keyword)) continue;
    if (rule.action === 'ignore') {
      ignore = true;
    } else if (rule.action === 'categorize' && categoryId === null) {
      categoryId = rule.categoryId;
    }
  }

  return { ignore, categoryId };
};
