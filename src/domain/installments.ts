/**
 * Detecção de **parcelamento** em lançamentos de cartão de crédito.
 *
 * A informação da parcela vem embutida na descrição do extrato (ex.: "UBER
 * 3/10", "NETFLIX PARCELA 03/12"). Aqui extraímos "parcela atual / total" e
 * agrupamos as parcelas de uma mesma compra — tudo de forma pura e testável,
 * sem depender do schema do banco (a descrição já carrega o dado).
 */
import { normalizeText } from './categorizationEngine';

export interface Installment {
  /** Número da parcela atual (1-based). */
  current: number;
  /** Total de parcelas da compra. */
  total: number;
  /** Rótulo curto, ex.: "3/10". */
  label: string;
}

const MIN_TOTAL = 2;
const MAX_TOTAL = 72;

const isValid = (current: number, total: number): boolean =>
  Number.isInteger(current) &&
  Number.isInteger(total) &&
  total >= MIN_TOTAL &&
  total <= MAX_TOTAL &&
  current >= 1 &&
  current <= total;

const make = (current: number, total: number): Installment => ({
  current,
  total,
  label: `${current}/${total}`,
});

// "PARCELA 3/10", "PARC 03 DE 12", "PARC. 3/12" (texto já normalizado/maiúsculo).
const KEYED = /PARC(?:ELA)?\.?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})/;
// "3/10", "(03/12)" isolado — grupos: prefixo | atual | total. Global para
// varrer candidatos (pode haver uma DATA antes da parcela). O `(?![\d/])` barra
// datas completas dd/mm/aaaa ("01/12/2024").
const BARE_SCAN = /(^|[\s(])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g;
// "N DE M" isolado, sem a palavra "parcela" (ex.: cartão XP: "2 de 2").
// Texto já normalizado (maiúsculo, sem acento).
const BARE_DE_SCAN = /(^|[\s(])(\d{1,2})\s+DE\s+(\d{1,2})(?!\d)/g;
// Uma hora logo após o "N/M" ("01/02 09:12") indica DATA, não parcela.
const TIME_AFTER = /^\s*\d{1,2}[:h]\d{2}/i;

/**
 * Extrai a parcela de uma descrição, ou `null` quando não parece parcelado.
 * Prioriza a forma com a palavra "parcela". Na forma isolada "N/M", ignora o
 * que na verdade é uma DATA dd/mm — caso comum em extratos bancários, ex.:
 * "01/02 09:12 FULANO" (Pix) NÃO é parcela 1/2.
 */
export const parseInstallment = (description: string): Installment | null => {
  const text = normalizeText(description);
  if (!text) return null;

  // 1) Forma explícita "PARCELA/PARC N/M" — confiável, vence.
  const keyed = text.match(KEYED);
  if (keyed) {
    const c = Number(keyed[1]);
    const t = Number(keyed[2]);
    if (isValid(c, t)) return make(c, t);
  }

  // 2) Forma isolada "N/M" — varre candidatos e descarta datas.
  BARE_SCAN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BARE_SCAN.exec(text)) !== null) {
    const c = Number(m[2]);
    const t = Number(m[3]);
    if (!isValid(c, t)) continue;

    const numStart = m.index + m[1].length; // posição do 1º dígito
    const atStart = numStart === 0; // "01/02 …" no começo da descrição
    const followedByTime = TIME_AFTER.test(text.slice(BARE_SCAN.lastIndex));
    const looksLikeDate = c >= 1 && c <= 31 && t >= 1 && t <= 12;

    // Data dd/mm (no começo, ou seguida de hora) → não é parcela.
    if (looksLikeDate && (atStart || followedByTime)) continue;

    return make(c, t);
  }

  // 3) Forma isolada "N DE M" (ex.: cartão XP: "2 de 2").
  BARE_DE_SCAN.lastIndex = 0;
  let d: RegExpExecArray | null;
  while ((d = BARE_DE_SCAN.exec(text)) !== null) {
    const c = Number(d[2]);
    const t = Number(d[3]);
    if (isValid(c, t)) return make(c, t);
  }

  return null;
};

/** Um lançamento é parcelado quando há informação de parcela na descrição. */
export const isInstallment = (description: string): boolean =>
  parseInstallment(description) !== null;

// Versões "globais" (com a flag g e case-insensitive) para remover o trecho da
// parcela da descrição, preservando a caixa original para exibição.
const KEYED_G = /parc(?:ela)?\.?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}/gi;
const BARE_G = /(?:^|[\s(])\d{1,2}\s*\/\s*\d{1,2}(?![\d/])/gi;
const BARE_DE_G = /(?:^|[\s(])\d{1,2}\s+de\s+\d{1,2}(?!\d)/gi;

/** Remove o "N/M" / "N de M" (e "parcela") da descrição, mantendo o resto. */
export const stripInstallment = (description: string): string =>
  description
    .replace(KEYED_G, ' ')
    .replace(BARE_G, ' ')
    .replace(BARE_DE_G, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[-–—]\s*$/, '')
    .trim();

/** Chave normalizada para agrupar as parcelas de uma MESMA compra. */
export const installmentGroupKey = (description: string): string =>
  normalizeText(stripInstallment(description));

export interface InstallmentGroup<T> {
  key: string;
  /** Descrição legível da compra (sem o "N/M"). */
  label: string;
  /** Total de parcelas. */
  total: number;
  /** Valor de cada parcela. */
  amount: number;
  /** Quantas parcelas distintas já foram lançadas. */
  paid: number;
  /** Maior número de parcela já visto (progresso). */
  lastCurrent: number;
  /** Lançamentos da compra, ordenados pela parcela. */
  items: T[];
}

/**
 * Agrupa parcelas de uma mesma compra. Duas parcelas pertencem à mesma compra
 * quando têm a mesma descrição-base, o mesmo total e o mesmo valor.
 * Ordena as compras "em andamento" (faltam parcelas) primeiro.
 */
export const groupInstallments = <
  T extends { description: string; amount: number },
>(
  items: T[]
): InstallmentGroup<T>[] => {
  const groups = new Map<
    string,
    {
      info: Installment;
      label: string;
      list: Array<{ item: T; current: number }>;
    }
  >();

  for (const item of items) {
    const inst = parseInstallment(item.description);
    if (!inst) continue;
    const base = installmentGroupKey(item.description);
    const key = `${base}|${inst.total}|${item.amount.toFixed(2)}`;
    const group = groups.get(key) ?? {
      info: inst,
      label: stripInstallment(item.description),
      list: [],
    };
    group.list.push({ item, current: inst.current });
    groups.set(key, group);
  }

  const out: InstallmentGroup<T>[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group.list].sort((a, b) => a.current - b.current);
    out.push({
      key,
      label: group.label || sorted[0]?.item.description || 'Compra parcelada',
      total: group.info.total,
      amount: sorted[0]?.item.amount ?? 0,
      paid: new Set(sorted.map((s) => s.current)).size,
      lastCurrent: sorted[sorted.length - 1]?.current ?? 0,
      items: sorted.map((s) => s.item),
    });
  }

  return out.sort((a, b) => {
    const aOpen = a.lastCurrent < a.total ? 1 : 0;
    const bOpen = b.lastCurrent < b.total ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen; // em andamento primeiro
    return b.amount * b.total - a.amount * a.total; // depois pelo maior valor
  });
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Soma `n` meses a uma data ISO (YYYY-MM-DD), com clamp do dia no fim do mês. */
export const addMonths = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m) return '';
  const base = new Date(y, m - 1 + n, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d || 1, lastDay))}`;
};

export interface ScheduleEntry {
  /** Número da parcela (1-based). */
  current: number;
  /** Data estimada da cobrança (ISO), ou '' se não der para estimar. */
  date: string;
  /** Já lançada (nº ≤ última parcela vista). */
  paid: boolean;
}

/**
 * Monta o cronograma de cobrança das parcelas (1..total). Nas faturas de cartão
 * a linha da parcela costuma repetir a **data da compra** — então estimamos a
 * cobrança de cada parcela como "data da compra + (n-1) meses". Se as datas já
 * vierem espalhadas (um mês por parcela), retrocede a partir da menor parcela
 * para achar a data da compra e mantém o mesmo espaçamento.
 */
export const installmentSchedule = (
  items: Array<{ date: string; description: string }>,
  total: number,
  lastCurrent: number
): ScheduleEntry[] => {
  const withCurrent = items
    .map((it) => ({
      date: it.date,
      current: parseInstallment(it.description)?.current ?? 1,
    }))
    .sort((a, b) => a.current - b.current);

  const distinctDates = new Set(items.map((it) => it.date));
  const first = withCurrent[0];
  const purchaseDate = first
    ? distinctDates.size <= 1
      ? first.date // extrato repete a data da compra em todas as parcelas
      : addMonths(first.date, -(first.current - 1)) // datas já espalhadas
    : '';

  const schedule: ScheduleEntry[] = [];
  for (let n = 1; n <= total; n += 1) {
    schedule.push({
      current: n,
      date: purchaseDate ? addMonths(purchaseDate, n - 1) : '',
      paid: n <= lastCurrent,
    });
  }
  return schedule;
};
