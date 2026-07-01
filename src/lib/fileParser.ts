/**
 * Parser de extratos bancários — o "motor" da importação automática.
 *
 * Formatos suportados:
 *   - OFX / OFC : parsing das tags <TRNTYPE>, <DTPOSTED>, <TRNAMT>, <MEMO>.
 *   - PDF       : extração de texto via pdf.js + heurística de linhas.
 *
 * Toda função retorna SEMPRE o formato padronizado `ParsedTransaction[]`,
 * desacoplando o resto do app do formato de origem.
 */

import type { TransactionType } from './database.types';

/** Formato padronizado de saída de qualquer parser de extrato. */
export interface ParsedTransaction {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Descrição/histórico do lançamento. */
  description: string;
  /** Valor SEMPRE positivo; o sinal é representado por `type`. */
  amount: number;
  /** `income` (entrada/crédito) ou `expense` (saída/débito). */
  type: TransactionType;
}

// -----------------------------------------------------------------------------
// Erros tipados (permitem mensagens amigáveis na UI)
// -----------------------------------------------------------------------------

export class FileParseError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FileParseError';
    this.cause = cause;
  }
}

export class UnsupportedFormatError extends FileParseError {
  constructor(extension: string) {
    super(
      `Formato não suportado: ".${extension}". Envie um arquivo OFX, OFC ou PDF.`
    );
    this.name = 'UnsupportedFormatError';
  }
}

// -----------------------------------------------------------------------------
// Utilitários numéricos / de data compartilhados
// -----------------------------------------------------------------------------

/**
 * Converte um valor monetário textual para número, tolerando os formatos
 * brasileiro ("1.234,56") e internacional ("1,234.56" / "1234.56").
 * Preserva o sinal.
 */
export const parseAmount = (raw: string): number => {
  const cleaned = raw.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return NaN;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // O último separador é o decimal; o outro é separador de milhar.
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.') // pt-BR: 1.234,56
        : cleaned.replace(/,/g, ''); // en-US: 1,234.56
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.'); // 1234,56
  }

  return Number.parseFloat(normalized);
};

/** Determina o tipo a partir do sinal do valor, com fallback no TRNTYPE. */
const resolveType = (amount: number, trnType?: string): TransactionType => {
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  const credit = /CREDIT|DEP|DIRECTDEP|INT|XFER/i;
  return trnType && credit.test(trnType) ? 'income' : 'expense';
};

// =============================================================================
// OFX / OFC
// =============================================================================

/** Extrai o valor de uma tag SGML/OFX (que pode vir sem fechamento). */
const readTag = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
  return match ? match[1].trim() : '';
};

/** Converte DTPOSTED ("YYYYMMDD..." ) para ISO "YYYY-MM-DD". */
const parseOfxDate = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const parseOfxTransaction = (block: string): ParsedTransaction | null => {
  const dtPosted = readTag(block, 'DTPOSTED');
  const trnAmt = readTag(block, 'TRNAMT');
  if (!dtPosted || !trnAmt) return null;

  const date = parseOfxDate(dtPosted);
  const amount = parseAmount(trnAmt);
  if (!date || Number.isNaN(amount)) return null;

  const description =
    readTag(block, 'MEMO') || readTag(block, 'NAME') || 'Sem descrição';

  return {
    date,
    description: description.replace(/\s+/g, ' ').trim(),
    amount: Math.abs(amount),
    type: resolveType(amount, readTag(block, 'TRNTYPE')),
  };
};

/**
 * Faz o parsing de um conteúdo OFX/OFC. Cada lançamento vive em um bloco
 * `<STMTTRN>...`. Lança `FileParseError` se nenhum lançamento for encontrado.
 */
export const parseOfx = (content: string): ParsedTransaction[] => {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const transactions = blocks
    .map(parseOfxTransaction)
    .filter((tx): tx is ParsedTransaction => tx !== null);

  if (transactions.length === 0) {
    throw new FileParseError(
      'Não encontramos lançamentos neste arquivo OFX/OFC. Ele pode estar vazio ou corrompido.'
    );
  }
  return transactions;
};

// =============================================================================
// PDF (pdf.js)
// =============================================================================

// Importação dinâmica: o pdf.js (pesado) só é carregado quando há um PDF,
// mantendo o parsing de OFX/OFC leve.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

const getPdfjs = async (): Promise<typeof import('pdfjs-dist')> => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (
        await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
};

/**
 * Extrai o texto bruto de um PDF de forma assíncrona, reconstruindo as linhas
 * a partir da posição vertical de cada fragmento de texto (pdf.js entrega os
 * itens sem quebras de linha).
 */
export const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      // Agrupa os fragmentos por linha (coordenada Y arredondada).
      const lines = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        const line = lines.get(y) ?? [];
        line.push({ x, text: item.str });
        lines.set(y, line);
      }

      // Y maior = mais ao topo da página; ordena de cima para baixo.
      const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]);
      for (const [, fragments] of ordered) {
        const text = fragments
          .sort((a, b) => a.x - b.x)
          .map((fragment) => fragment.text)
          .join(' ');
        pages.push(text);
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join('\n');
};

// Heurística para extratos brasileiros: data dd/mm/aaaa + valor 1.234,56.
const PDF_DATE = /(\d{2}\/\d{2}\/\d{2,4})/;
const PDF_AMOUNT = /-?\s?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}/g;

const toIsoDate = (br: string): string => {
  const [d, m, yRaw] = br.split('/');
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/**
 * Converte o texto bruto de um extrato em lançamentos padronizados.
 *
 * Heurística genérica (best-effort): cada linha com uma data + um valor vira
 * um lançamento. O sinal (`-` ou marcação `D`/`C`) define receita/despesa.
 * Layouts de PDF variam muito entre bancos — ajuste este parser conforme o
 * banco alvo. O caminho OFX/OFC é sempre mais confiável.
 */
export const parseStatementText = (text: string): ParsedTransaction[] => {
  const transactions: ParsedTransaction[] = [];

  for (const line of text.split('\n')) {
    const dateMatch = line.match(PDF_DATE);
    if (!dateMatch) continue;

    const amounts = line.match(PDF_AMOUNT);
    if (!amounts || amounts.length === 0) continue;

    // 1º valor da linha = lançamento (o 2º costuma ser o saldo).
    const rawAmount = amounts[0];
    const amount = parseAmount(rawAmount);
    if (Number.isNaN(amount) || amount === 0) continue;

    const date = toIsoDate(dateMatch[1]);
    const description = line
      .replace(dateMatch[1], '')
      .replace(rawAmount, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Marcação de débito/crédito comum em extratos brasileiros.
    const isDebit = /(^|\s)D(\s|$)/.test(line) || rawAmount.includes('-');
    const isCredit = /(^|\s)C(\s|$)/.test(line);
    const type: TransactionType = isCredit && !isDebit ? 'income' : 'expense';

    transactions.push({
      date,
      description: description || 'Lançamento',
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : type,
    });
  }

  return transactions;
};

/** Lê um PDF e retorna os lançamentos padronizados. */
export const parsePdf = async (
  data: ArrayBuffer
): Promise<ParsedTransaction[]> => {
  const text = await extractPdfText(data);
  const transactions = parseStatementText(text);

  if (transactions.length === 0) {
    throw new FileParseError(
      'Lemos o PDF, mas não identificamos lançamentos automaticamente. ' +
        'Tente exportar o extrato no formato OFX/OFC para um resultado preciso.'
    );
  }
  return transactions;
};

// =============================================================================
// Dispatcher principal
// =============================================================================

const getExtension = (fileName: string): string =>
  fileName.split('.').pop()?.toLowerCase() ?? '';

/**
 * Ponto de entrada: detecta o formato pelo nome do arquivo e delega ao parser
 * adequado. Sempre resolve para `ParsedTransaction[]` ou lança um
 * `FileParseError`/`UnsupportedFormatError` com mensagem amigável.
 */
export const parseStatementFile = async (
  file: File
): Promise<ParsedTransaction[]> => {
  const extension = getExtension(file.name);

  try {
    switch (extension) {
      case 'ofx':
      case 'ofc':
        return parseOfx(await file.text());
      case 'pdf':
        return parsePdf(await file.arrayBuffer());
      default:
        throw new UnsupportedFormatError(extension || 'desconhecido');
    }
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    // Envolve erros inesperados (ex.: PDF protegido) em mensagem amigável.
    throw new FileParseError(
      'Não foi possível ler o arquivo. Verifique se ele não está protegido ou corrompido.',
      error
    );
  }
};
