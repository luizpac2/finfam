/**
 * Parser de extratos bancários — o "motor" da importação automática.
 *
 * Formatos suportados:
 *   - OFX / OFC : tags <TRNTYPE>, <DTPOSTED>, <TRNAMT>, <MEMO> (tolerante a SGML).
 *   - CSV       : detecção de delimitador + colunas (data, descrição, valor…).
 *   - TXT       : sniff — trata como OFX, CSV ou texto genérico conforme conteúdo.
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
      `Formato não suportado: ".${extension}". Envie OFX, OFC, CSV, TXT ou PDF.`
    );
    this.name = 'UnsupportedFormatError';
  }
}

// -----------------------------------------------------------------------------
// Utilitários compartilhados (número, data, texto, leitura de arquivo)
// -----------------------------------------------------------------------------

/**
 * Converte um valor monetário textual para número, tolerando os formatos
 * brasileiro ("1.234,56") e internacional ("1,234.56" / "1234.56").
 * Preserva o sinal.
 */
export const parseAmount = (raw: string): number => {
  const cleaned = (raw ?? '').replace(/[^\d,.-]/g, '').trim();
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

/** Aceita datas ISO (YYYY-MM-DD) e brasileiras (DD/MM/AAAA, DD-MM-AA). */
export const parseFlexibleDate = (raw: string): string => {
  const s = (raw ?? '').trim();
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // ISO
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // dd/mm/aaaa
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
};

/** Normaliza texto para comparação: sem acento, maiúsculas. */
const normalize = (value: string): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();

/** Determina o tipo a partir do sinal do valor, com fallback no TRNTYPE. */
const resolveType = (amount: number, trnType?: string): TransactionType => {
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  const credit = /CREDIT|DEP|DIRECTDEP|INT|XFER/i;
  return trnType && credit.test(trnType) ? 'income' : 'expense';
};

/**
 * Lê o arquivo como texto tratando a codificação. Muitos bancos brasileiros
 * exportam em Windows-1252/ISO-8859-1; se a decodificação UTF-8 gerar
 * caracteres de substituição, tenta latin1 para não embaralhar os acentos.
 */
const readFileText = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // UTF-16 com BOM.
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }

  // UTF-16 sem BOM: bytes nulos frequentes indicam texto de 2 bytes/caractere.
  const sample = bytes.subarray(0, Math.min(bytes.length, 400));
  let nullEven = 0;
  let nullOdd = 0;
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0x00) {
      if (i % 2 === 0) nullEven += 1;
      else nullOdd += 1;
    }
  }
  const threshold = sample.length / 8;
  if (nullOdd > threshold) return new TextDecoder('utf-16le').decode(buffer);
  if (nullEven > threshold) return new TextDecoder('utf-16be').decode(buffer);

  // UTF-8, com fallback para Windows-1252 (comum em bancos BR).
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (utf8.includes('�')) {
    try {
      return new TextDecoder('windows-1252').decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
};

// =============================================================================
// OFX / OFC
// =============================================================================

/**
 * Extrai o valor de uma tag SGML/OFX (que pode vir sem fechamento).
 * Tolerante a espaços/quebra de linha após a tag (ex.: valor na linha seguinte)
 * — lê tudo até o próximo `<`.
 */
const readTag = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}>\\s*([^<]*)`, 'i'));
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
 * `<STMTTRN>...`. Lança `FileParseError` com diagnóstico específico.
 */
export const parseOfx = (content: string): ParsedTransaction[] => {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  if (blocks.length === 0) {
    // Diagnóstico: lista as tags presentes para revelar a estrutura do arquivo.
    const foundTags = [
      ...new Set(
        (content.match(/<[A-Za-z][A-Za-z0-9.]*/g) ?? []).map((t) =>
          t.toUpperCase()
        )
      ),
    ].slice(0, 12);
    throw new FileParseError(
      foundTags.length > 0
        ? `Não encontramos blocos <STMTTRN>. Tags no arquivo: ${foundTags.join(', ')}.`
        : 'Não conseguimos ler o conteúdo (codificação incomum ou arquivo vazio).'
    );
  }

  const transactions = blocks
    .map(parseOfxTransaction)
    .filter((tx): tx is ParsedTransaction => tx !== null);

  if (transactions.length === 0) {
    throw new FileParseError(
      `Encontramos ${blocks.length} lançamento(s) no OFX, mas não conseguimos ler ` +
        'data/valor deles. Envie uma amostra do arquivo para ajustarmos o leitor.'
    );
  }
  return transactions;
};

// =============================================================================
// CSV
// =============================================================================

const CSV_DELIMITERS = [';', ',', '\t', '|'];

const detectDelimiter = (lines: string[]): string => {
  let best = ';';
  let bestScore = -1;
  for (const delim of CSV_DELIMITERS) {
    const counts = lines.map((l) => l.split(delim).length);
    const max = Math.max(...counts);
    if (max <= 1) continue;
    const consistent = counts.filter((c) => c === max).length;
    const score = max + consistent;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  return best;
};

/** Divide uma linha CSV respeitando aspas duplas. */
const splitCsvLine = (line: string, delim: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

const looksLikeCsv = (text: string): boolean => {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 8);
  if (lines.length < 2) return false;
  return CSV_DELIMITERS.some((d) => lines.every((l) => l.split(d).length >= 2));
};

/**
 * Faz o parsing de um CSV de extrato. Detecta o delimitador e localiza as
 * colunas por nome no cabeçalho (data, descrição, valor OU crédito/débito).
 */
export const parseCsv = (text: string): ParsedTransaction[] => {
  const rows = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (rows.length === 0) throw new FileParseError('O arquivo CSV está vazio.');

  const delimiter = detectDelimiter(rows.slice(0, 8));

  const isHeaderRow = (cells: string[]): boolean => {
    const norm = cells.map(normalize);
    const hasDate = norm.some((c) => /DATA|DATE/.test(c));
    const hasValue = norm.some((c) =>
      /VALOR|AMOUNT|MONTANTE|VALUE|VLR|CREDITO|CREDIT|DEBITO|DEBIT/.test(c)
    );
    return hasDate && hasValue;
  };

  const headerIndex = rows.findIndex((l) =>
    isHeaderRow(splitCsvLine(l, delimiter))
  );
  if (headerIndex === -1) {
    throw new FileParseError(
      'Não reconhecemos as colunas do CSV. É preciso pelo menos uma coluna de ' +
        'data e uma de valor (ex.: "Data" e "Valor").'
    );
  }

  const header = splitCsvLine(rows[headerIndex], delimiter).map(normalize);
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const dateCol = col(/DATA|DATE/);
  const descCol = col(/DESCRI|HISTOR|LANCAMENTO|MEMO|DETALHE|TRANSA|OBSERV/);
  const amountCol = col(/VALOR|AMOUNT|MONTANTE|VALUE|VLR/);
  const creditCol = col(/CREDITO|CREDIT|ENTRADA/);
  const debitCol = col(/DEBITO|DEBIT|SAIDA/);
  const typeCol = col(/TIPO|TYPE|NATUREZA/);

  const transactions: ParsedTransaction[] = [];
  for (const line of rows.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line, delimiter);
    const date = parseFlexibleDate(cells[dateCol] ?? '');
    if (!date) continue;

    let amount = NaN;
    let type: TransactionType = 'expense';

    if (amountCol >= 0 && cells[amountCol]) {
      amount = parseAmount(cells[amountCol]);
      type = amount < 0 ? 'expense' : 'income';
    } else if (creditCol >= 0 || debitCol >= 0) {
      const credit = creditCol >= 0 ? parseAmount(cells[creditCol] ?? '') : NaN;
      const debit = debitCol >= 0 ? parseAmount(cells[debitCol] ?? '') : NaN;
      if (!Number.isNaN(credit) && Math.abs(credit) > 0) {
        amount = credit;
        type = 'income';
      } else if (!Number.isNaN(debit) && Math.abs(debit) > 0) {
        amount = debit;
        type = 'expense';
      }
    }

    // Uma coluna de tipo (D/C, débito/crédito) sobrepõe o sinal.
    if (typeCol >= 0 && cells[typeCol]) {
      const t = normalize(cells[typeCol]);
      if (/^D|DEBIT|SAIDA|DESPESA/.test(t)) type = 'expense';
      else if (/^C|CREDIT|ENTRADA|RECEITA/.test(t)) type = 'income';
    }

    if (Number.isNaN(amount) || amount === 0) continue;

    const description = (descCol >= 0 ? cells[descCol] : '') || 'Lançamento';
    transactions.push({
      date,
      description: description.replace(/\s+/g, ' ').trim(),
      amount: Math.abs(amount),
      type,
    });
  }

  if (transactions.length === 0) {
    throw new FileParseError(
      'Lemos o CSV, mas não encontramos lançamentos válidos (data + valor).'
    );
  }
  return transactions;
};

// =============================================================================
// Texto genérico (usado por PDF e TXT sem estrutura)
// =============================================================================

// Linha de lançamento: Dia … Valor (+)/(-).  Grupos: data | meio | valor | sinal | resto
const TX_LINE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.*?)(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)(.*)$/;

// Cabeçalhos/rodapés/saldos que não fazem parte do histórico.
const NOISE_LINE =
  /^(extrato de conta|cliente\b|per[ií]odo|ag[êe]ncia|lan[çc]amentos|dia lote|informa[çc]|total\b|taxa\b|tributos|custo efetivo|data venc|valor (total|liberado)|despesas|tarifa\b|\(\*\)|saldo\b|s a l d o|limite\b)/i;

const isNoiseLine = (line: string): boolean => {
  const compact = line.replace(/\s+/g, '').toLowerCase();
  if (/^(bancodobrasil)+$/.test(compact)) return true; // marca d'água
  return NOISE_LINE.test(line);
};

/** Remove códigos numéricos iniciais (Lote/Documento) mantendo o texto. */
const stripLeadingCodes = (value: string): string => {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length && /^[\d.\-/]+$/.test(tokens[i])) i += 1;
  return tokens.slice(i).join(' ');
};

interface Pending {
  date: string;
  amount: number;
  type: TransactionType;
  parts: string[];
}

/**
 * Converte texto bruto de extrato em lançamentos padronizados.
 *
 * Formato do Banco do Brasil (colunas Dia | Lote | Documento | Histórico |
 * Valor): a linha do lançamento traz `Dia … Valor (+)/(-)`, e o **Histórico
 * ocupa as linhas seguintes**. Portanto:
 *  - o SINAL `(+)` → receita e `(-)` → despesa;
 *  - a DESCRIÇÃO acumula o texto até o próximo lançamento, ignorando as
 *    colunas numéricas (Lote/Documento), saldos e ruídos.
 */
export const parseStatementText = (text: string): ParsedTransaction[] => {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const transactions: ParsedTransaction[] = [];
  let current: Pending | null = null;

  const flush = () => {
    if (current && current.amount > 0) {
      const description = current.parts.join(' ').replace(/\s+/g, ' ').trim();
      transactions.push({
        date: current.date,
        description: description || 'Lançamento',
        amount: current.amount,
        type: current.type,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const match = line.match(TX_LINE);
    if (match) {
      flush();
      const [, dmy, middle, rawValue, sign, trailing] = match;
      const date = parseFlexibleDate(dmy);
      const amount = parseAmount(rawValue);
      current =
        date && !Number.isNaN(amount)
          ? {
              date,
              amount: Math.abs(amount),
              type: sign === '-' ? 'expense' : 'income',
              parts: [stripLeadingCodes(middle), trailing.trim()].filter(Boolean),
            }
          : null;
      continue;
    }

    if (!current) continue;
    if (isNoiseLine(line)) {
      // "Saldo do dia" e afins encerram o histórico do lançamento atual.
      if (/^(saldo|s a l d o)/i.test(line)) flush();
      continue;
    }
    current.parts.push(line);
  }
  flush();

  return transactions;
};

// =============================================================================
// PDF (pdf.js)
// =============================================================================

// Importação dinâmica: o pdf.js (pesado) só é carregado quando há um PDF.
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
 * a partir da posição vertical de cada fragmento de texto.
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

      const lines = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        const line = lines.get(y) ?? [];
        line.push({ x, text: item.str });
        lines.set(y, line);
      }

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

/** Lê um PDF e retorna os lançamentos padronizados. */
export const parsePdf = async (
  data: ArrayBuffer
): Promise<ParsedTransaction[]> => {
  const text = await extractPdfText(data);
  const transactions = parseStatementText(text);

  if (transactions.length === 0) {
    throw new FileParseError(
      'Lemos o PDF, mas não identificamos lançamentos automaticamente. ' +
        'Tente exportar o extrato no formato OFX/OFC ou CSV para um resultado preciso.'
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
 * Lançamentos automáticos que NÃO representam receita/despesa reais e que
 * devem ser ignorados em qualquer formato (ex.: aplicação/resgate automático
 * "BB Rende Fácil"). Filtra pela descrição.
 */
const IGNORED_DESCRIPTION = /rende\s*f[aá]cil/i;

const excludeIgnored = (
  transactions: ParsedTransaction[]
): ParsedTransaction[] =>
  transactions.filter((tx) => !IGNORED_DESCRIPTION.test(tx.description));

/** Roteia o conteúdo textual para o parser certo (com sniff de OFX/CSV). */
const parseTextContent = (text: string, ext: string): ParsedTransaction[] => {
  // Sniff pelo conteúdo: se parece OFX, usa o parser OFX mesmo se a extensão
  // for .txt (bancos às vezes entregam OFX com outra extensão).
  if (/<OFX[>\s]|<STMTTRN[>\s]/i.test(text)) return parseOfx(text);

  switch (ext) {
    case 'ofx':
    case 'ofc':
      return parseOfx(text);
    case 'csv':
      return parseCsv(text);
    case 'txt': {
      const result = looksLikeCsv(text)
        ? parseCsv(text)
        : parseStatementText(text);
      if (result.length === 0) {
        throw new FileParseError(
          'Não identificamos lançamentos no arquivo .txt. Se for um extrato, ' +
            'prefira exportar em OFX/OFC ou CSV.'
        );
      }
      return result;
    }
    default:
      if (looksLikeCsv(text)) return parseCsv(text);
      throw new UnsupportedFormatError(ext || 'desconhecido');
  }
};

/**
 * Ponto de entrada: detecta o formato e delega ao parser adequado. Sempre
 * resolve para `ParsedTransaction[]` ou lança um `FileParseError`/
 * `UnsupportedFormatError` com mensagem amigável.
 */
export const parseStatementFile = async (
  file: File
): Promise<ParsedTransaction[]> => {
  const extension = getExtension(file.name);

  try {
    if (extension === 'pdf') {
      return excludeIgnored(await parsePdf(await file.arrayBuffer()));
    }
    const text = await readFileText(file);
    return excludeIgnored(parseTextContent(text, extension));
  } catch (error) {
    if (error instanceof FileParseError) throw error;
    // Envolve erros inesperados (ex.: PDF protegido) em mensagem amigável.
    throw new FileParseError(
      'Não foi possível ler o arquivo. Verifique se ele não está protegido ou corrompido.',
      error
    );
  }
};
