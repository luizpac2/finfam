import Anthropic from '@anthropic-ai/sdk';

/**
 * Função serverless (Vercel) de categorização por IA.
 *
 * Recebe lançamentos sem categoria + a lista de categorias disponíveis e pede
 * ao Claude para escolher a melhor categoria (pelo NOME) para cada um. A chave
 * da API fica apenas no servidor (`ANTHROPIC_API_KEY`), nunca no navegador.
 *
 * Modelo padrão: claude-opus-4-8. Para reduzir custo, defina a env var
 * ANTHROPIC_MODEL (ex.: "claude-haiku-4-5") no painel da Vercel.
 */

export const config = { maxDuration: 60 };

interface CategorizeItem {
  id: string;
  description: string;
  type: 'income' | 'expense';
}

interface CategoryOption {
  name: string;
  kind: 'income' | 'expense';
}

const SYSTEM_PROMPT = `Você é um categorizador de lançamentos financeiros de um app de finanças pessoais brasileiro. Recebe descrições de extrato bancário (em português, muitas vezes abreviadas) e uma lista de categorias permitidas, cada uma com um tipo (income = receita, expense = despesa).

Para cada lançamento, escolha a ÚNICA categoria que melhor descreve a descrição, respeitando o tipo do lançamento (um lançamento "expense" só pode receber uma categoria "expense"; "income" só "income"). Use exatamente um dos NOMES fornecidos, copiado igual. Se nenhuma categoria fizer sentido, devolva string vazia ("").

Responda apenas no formato solicitado, sem comentários.`;

// Definição de tipos mínima para o runtime da Vercel (evita depender de @vercel/node).
type Req = { method?: string; body?: unknown };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        'Categorização por IA não configurada: defina ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.',
    });
    return;
  }

  const body =
    typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  const items: CategorizeItem[] = Array.isArray(body.items) ? body.items : [];
  const categories: CategoryOption[] = Array.isArray(body.categories)
    ? body.categories
    : [];

  if (items.length === 0) {
    res.status(200).json({ results: [] });
    return;
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  const userPayload = {
    categorias_disponiveis: categories,
    lancamentos: items.map((i) => ({
      id: i.id,
      descricao: i.description,
      tipo: i.type,
    })),
  };

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    category: { type: 'string' },
                  },
                  required: ['id', 'category'],
                  additionalProperties: false,
                },
              },
            },
            required: ['results'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content:
            'Categorize os lançamentos abaixo. Devolva um objeto com "results": um array com { id, category } para cada lançamento, onde category é o NOME exato de uma categoria compatível ou "" se nenhuma servir.\n\n' +
            JSON.stringify(userPayload),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '{}';
    const parsed = JSON.parse(text);
    res.status(200).json({ results: parsed.results ?? [] });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Falha ao categorizar com IA.';
    res.status(502).json({ error: message });
  }
}
