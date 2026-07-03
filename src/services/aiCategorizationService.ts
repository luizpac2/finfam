import type { TransactionType } from '../lib/database.types';

/**
 * Cliente do endpoint de categorização por IA (`/api/categorize`).
 * O endpoint roda no servidor (Vercel) e conversa com o Claude — a chave da API
 * nunca chega ao navegador.
 */

export interface AiCategorizeItem {
  id: string;
  description: string;
  type: TransactionType;
}

export interface AiCategoryOption {
  name: string;
  kind: TransactionType;
}

const CHUNK_SIZE = 50;

const chunk = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * Envia lançamentos sem categoria para a IA e retorna um mapa
 * `id da transação → NOME da categoria sugerida` (apenas os que a IA classificou).
 */
export const aiCategorizationService = {
  async categorize(
    items: AiCategorizeItem[],
    categories: AiCategoryOption[]
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const part of chunk(items, CHUNK_SIZE)) {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: part, categories }),
      });

      if (!response.ok) {
        let message = 'Falha na categorização por IA.';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          /* resposta sem corpo JSON */
        }
        throw new Error(message);
      }

      const data = (await response.json()) as {
        results?: { id: string; category: string }[];
      };
      for (const r of data.results ?? []) {
        if (r.category) result.set(r.id, r.category);
      }
    }

    return result;
  },
};
