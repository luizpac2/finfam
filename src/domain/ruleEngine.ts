import type { CategoryRule } from './entities/CategoryRule';
import type { Category } from './entities/Category';
import type {
  CategoryKind,
  PaymentMethod,
  TransactionType,
} from '../lib/database.types';
import { normalizeText } from './categorizationEngine';

/** Tolerância para comparação de valores (centavos). */
const AMOUNT_EPSILON = 0.005;

/**
 * Verifica se uma regra casa com um lançamento (descrição + valor).
 * Uma condição só é exigida quando definida:
 *   - `keyword` (se houver) deve aparecer na descrição (sem acento/caixa);
 *   - `amount` (se houver) deve ser igual ao valor absoluto do lançamento.
 * Ambas as condições presentes precisam ser satisfeitas (E lógico).
 *
 * ⚠️ Não considera o TIPO (receita/despesa). Para categorização respeitando o
 * tipo, use `applyUserRules` (ou combine com `categoryKindMatchesType`).
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
 * A categoria da regra é compatível com o TIPO do lançamento?
 *   - lançamento de RECEITA só aceita categoria de receita;
 *   - lançamento de DESPESA só aceita categoria de despesa (ou cartão).
 * Assim, uma palavra que aparece tanto numa receita quanto numa despesa
 * (ex.: nome da escola: salário recebido × compra feita lá) não categoriza o
 * lançamento "do lado errado".
 */
export const categoryKindMatchesType = (
  kind: CategoryKind | undefined,
  type: TransactionType
): boolean => {
  if (!kind) return true; // categoria desconhecida → não bloqueia
  return type === 'income' ? kind === 'income' : kind !== 'income';
};

/** Mapa id→kind das categorias, para checar a compatibilidade de tipo. */
export const categoryKindMap = (
  categories: Category[]
): Map<string, CategoryKind> => {
  const map = new Map<string, CategoryKind>();
  for (const category of categories) map.set(category.id, category.kind);
  return map;
};

/**
 * Aplica as regras do usuário a um lançamento.
 *
 * - Regras de "ignore" têm precedência: se qualquer uma casar, o lançamento é
 *   ignorado.
 * - Para "categorize", vale a PRIMEIRA regra que casa E cuja categoria é do
 *   mesmo TIPO do lançamento (receita↔receita, despesa↔despesa/cartão).
 * - A forma de pagamento (`paymentMethod`) da PRIMEIRA regra que casa e a
 *   define é aplicada — independentemente do tipo (Pix/TED/dinheiro não têm
 *   direção de receita/despesa).
 *
 * `categoryKindById` é o mapa id→kind (ver `categoryKindMap`).
 */
export const applyUserRules = (
  description: string,
  amount: number,
  type: TransactionType,
  rules: CategoryRule[],
  categoryKindById: Map<string, CategoryKind>
): {
  ignore: boolean;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
} => {
  let categoryId: string | null = null;
  let paymentMethod: PaymentMethod | null = null;
  let ignore = false;

  for (const rule of rules) {
    if (!ruleMatches(rule, description, amount)) continue;
    if (rule.action === 'ignore') {
      ignore = true;
    } else if (rule.action === 'categorize') {
      if (
        categoryId === null &&
        rule.categoryId &&
        categoryKindMatchesType(categoryKindById.get(rule.categoryId), type)
      ) {
        categoryId = rule.categoryId;
      }
      if (paymentMethod === null && rule.paymentMethod) {
        paymentMethod = rule.paymentMethod;
      }
    }
  }

  return { ignore, categoryId, paymentMethod };
};
