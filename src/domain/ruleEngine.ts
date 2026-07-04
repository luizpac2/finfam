import type { CategoryRule } from './entities/CategoryRule';
import { normalizeText } from './categorizationEngine';

/** Tolerância para comparação de valores (centavos). */
const AMOUNT_EPSILON = 0.005;

/**
 * Verifica se uma regra casa com um lançamento (descrição + valor).
 * Uma condição só é exigida quando definida:
 *   - `keyword` (se houver) deve aparecer na descrição (sem acento/caixa);
 *   - `amount` (se houver) deve ser igual ao valor absoluto do lançamento.
 * Ambas as condições presentes precisam ser satisfeitas (E lógico).
 */
export const ruleMatches = (
  rule: CategoryRule,
  description: string,
  amount: number
): boolean => {
  const keyword = normalizeText(rule.keyword);
  const keywordOk =
    keyword === '' || normalizeText(description).includes(keyword);
  const amountOk =
    rule.amount == null ||
    Math.abs(Math.abs(amount) - rule.amount) < AMOUNT_EPSILON;
  // Precisa ter ao menos uma condição (garantido pelo banco) e todas casarem.
  return (keyword !== '' || rule.amount != null) && keywordOk && amountOk;
};

/**
 * Aplica as regras do usuário a um lançamento.
 *
 * Regras de "ignore" têm precedência: se qualquer uma casar, o lançamento é
 * ignorado. Para "categorize", vale a PRIMEIRA regra que casa (a ordem vem da
 * listagem — regras mais específicas primeiro).
 */
export const applyUserRules = (
  description: string,
  amount: number,
  rules: CategoryRule[]
): { ignore: boolean; categoryId: string | null } => {
  let categoryId: string | null = null;
  let ignore = false;

  for (const rule of rules) {
    if (!ruleMatches(rule, description, amount)) continue;
    if (rule.action === 'ignore') {
      ignore = true;
    } else if (rule.action === 'categorize' && categoryId === null) {
      categoryId = rule.categoryId;
    }
  }

  return { ignore, categoryId };
};
