/**
 * Motor de categorização heurística.
 *
 * Analisa a `description` (e o `type`) de uma transação importada e infere a
 * categoria mais provável a partir de um dicionário de palavras-chave.
 *
 * Estratégia: a primeira regra cujo conjunto de palavras-chave aparece na
 * descrição (normalizada) vence. Por isso a ORDEM importa — regras mais
 * específicas vêm antes das genéricas (ex.: "AMAZON PRIME" → Serviços antes de
 * "AMAZON" → Compras; "PIX/TED" → Transferências fica por último).
 */
import type { TransactionType } from '../lib/database.types';
import type { Category } from './entities/Category';

/** Remove acentos, deixa em maiúsculas e colapsa espaços (para comparação). */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos combinados
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface CategoryRule {
  /** Nome canônico da categoria (casado com `categories.name` no banco). */
  category: string;
  /** Palavras-chave já normalizadas (maiúsculas, sem acento). */
  keywords: string[];
  /** Restringe a regra a um tipo (ex.: "Salário" só faz sentido em receita). */
  onlyType?: TransactionType;
}

/**
 * Dicionário padrão de categorização. Edite/expanda livremente — os nomes de
 * categoria devem existir na tabela `categories` (ver migrations 0004/0005).
 */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Salário',
    onlyType: 'income',
    keywords: ['SALARIO', 'PROVENTO', 'VENCIMENTO', 'FOLHA PAGTO', 'HOLERITE'],
  },
  {
    category: 'Investimentos',
    keywords: [
      'RENDIMENTO',
      'DIVIDENDO',
      'CDB',
      'TESOURO',
      'APLICACAO',
      'RESGATE',
      'POUPANCA',
      'JUROS',
      'CORRETORA',
      'XP INVEST',
      'RICO',
      'NUINVEST',
    ],
  },
  {
    // Assinaturas/streaming antes de "Compras" (ex.: AMAZON PRIME ≠ AMAZON).
    category: 'Contas/Serviços',
    keywords: [
      'NETFLIX',
      'SPOTIFY',
      'AMAZON PRIME',
      'PRIME VIDEO',
      'DISNEY',
      'HBO',
      'MAX ',
      'YOUTUBE PREMIUM',
      'DEEZER',
      'GLOBOPLAY',
      'PARAMOUNT',
      'APPLE.COM',
      'GOOGLE ONE',
      'ICLOUD',
    ],
  },
  {
    category: 'Compras',
    keywords: [
      'AMAZON',
      'MERCADO LIVRE',
      'MERCADOLIVRE',
      'MELI',
      'SHOPEE',
      'ALIEXPRESS',
      'MAGAZINE',
      'MAGALU',
      'AMERICANAS',
      'RENNER',
      'RIACHUELO',
      'C&A',
      'ZARA',
      'SHOPPING',
      'LOJAS',
    ],
  },
  {
    category: 'Alimentação',
    keywords: [
      'IFOOD',
      'RAPPI',
      'ZE DELIVERY',
      'SUPERMERCADO',
      'MERCADO',
      'HORTIFRUTI',
      'ACOUGUE',
      'PADARIA',
      'RESTAURANTE',
      'LANCHONETE',
      'PIZZA',
      'BURGER',
      'MCDONALDS',
      'BK ',
      'SUBWAY',
      'CAFE',
      'BAR ',
    ],
  },
  {
    category: 'Transporte',
    keywords: [
      'UBER',
      '99 ',
      '99POP',
      '99APP',
      'CABIFY',
      'BLABLACAR',
      'METRO',
      'CPTM',
      'ONIBUS',
      'BUSER',
      'TAXI',
      'BILHETE UNICO',
    ],
  },
  {
    category: 'Veículo',
    keywords: [
      'POSTO',
      'IPIRANGA',
      'SHELL',
      'PETROBRAS',
      'COMBUSTIVEL',
      'GASOLINA',
      'ETANOL',
      'ALCOOL',
      'ESTACIONAMENTO',
      'PEDAGIO',
      'SEM PARAR',
      'CONECTCAR',
      'OFICINA',
      'AUTO PECAS',
      'IPVA',
      'DETRAN',
      'LICENCIAMENTO',
    ],
  },
  {
    category: 'Moradia',
    keywords: ['ALUGUEL', 'CONDOMINIO', 'IPTU', 'IMOBILIARIA'],
  },
  {
    category: 'Contas/Serviços',
    keywords: [
      'ENERGIA',
      'ENEL',
      'CEMIG',
      'LIGHT',
      'COPEL',
      'CPFL',
      'SABESP',
      'COPASA',
      'AGUA',
      'COMGAS',
      'GAS ',
      'VIVO',
      'CLARO',
      'TIM ',
      'OI ',
      'INTERNET',
      'TELEFON',
      'BOLETO',
    ],
  },
  {
    category: 'Saúde',
    keywords: [
      'FARMACIA',
      'DROGARIA',
      'DROGASIL',
      'DROGA RAIA',
      'RAIADROGASIL',
      'HOSPITAL',
      'CLINICA',
      'LABORATORIO',
      'UNIMED',
      'AMIL',
      'HAPVIDA',
      'DENTISTA',
      'PSICOLOG',
    ],
  },
  {
    category: 'Educação',
    keywords: [
      'ESCOLA',
      'COLEGIO',
      'FACULDADE',
      'UNIVERSIDADE',
      'CURSO',
      'UDEMY',
      'ALURA',
      'MENSALIDADE',
      'LIVRARIA',
    ],
  },
  {
    category: 'Lazer',
    keywords: [
      'CINEMA',
      'INGRESSO',
      'STEAM',
      'PLAYSTATION',
      'XBOX',
      'NINTENDO',
      'VIAGEM',
      'HOTEL',
      'AIRBNB',
      'BOOKING',
      'DECOLAR',
      'CLUBE',
    ],
  },
  {
    // Genérica — fica por último para não "roubar" merchants específicos.
    category: 'Transferências',
    keywords: [
      'PIX ENVIADO',
      'PIX RECEBIDO',
      'PIX',
      'TED',
      'DOC ',
      'TRANSFERENCIA',
      'TRANSFER',
    ],
  },
];

/** Nome de categoria usado como fallback quando nada é inferido. */
export const FALLBACK_CATEGORY = 'Outros';

/**
 * Sugere o NOME canônico da categoria para uma transação, ou `null` quando
 * nenhuma regra casa (deixando a decisão para o fallback/usuário).
 */
export const suggestCategoryName = (
  description: string,
  type: TransactionType
): string | null => {
  const text = normalizeText(description);
  if (!text) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.onlyType && rule.onlyType !== type) continue;
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.category;
    }
  }
  return null;
};

/**
 * Resolve a categoria sugerida para um ID real da tabela `categories`.
 * Faz o casamento por nome (ignorando acentos/caixa) e cai para "Outros"
 * quando disponível. Retorna `''` (sem categoria) se nada puder ser resolvido.
 */
export const suggestCategoryId = (
  description: string,
  type: TransactionType,
  categories: Category[]
): string => {
  // Só considera categorias do MESMO tipo (receita/despesa) da transação.
  const findByName = (name: string): Category | undefined =>
    categories.find(
      (c) => c.kind === type && normalizeText(c.name) === normalizeText(name)
    );

  const suggested = suggestCategoryName(description, type);
  if (suggested) {
    const match = findByName(suggested);
    if (match) return match.id;
  }

  return findByName(FALLBACK_CATEGORY)?.id ?? '';
};
