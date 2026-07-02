/**
 * Utilitários de formatação para a localidade pt-BR.
 */

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Formata um número como moeda brasileira (R$). */
export const formatCurrency = (value: number): string =>
  currencyFormatter.format(value ?? 0);

/** Versão compacta (ex.: "R$ 1,2 mil"), ideal para eixos de gráficos. */
export const formatCurrencyShort = (value: number): string =>
  compactCurrencyFormatter.format(value ?? 0);

const accountingCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  currencySign: 'accounting', // negativos entre parênteses: (R$ 1.234,56)
});

/**
 * Formata no padrão contábil: valores negativos aparecem entre parênteses,
 * ex.: `(R$ 1.234,56)`. Use com valores já sinalizados (despesa = negativa).
 */
export const formatCurrencyAccounting = (value: number): string =>
  accountingCurrencyFormatter.format(value ?? 0);

/** Formata uma data ISO (YYYY-MM-DD) como DD/MM/AAAA. */
export const formatDate = (isoDate: string): string => {
  if (!isoDate) return '';
  // Acrescenta T00:00 para evitar desvio de fuso ao interpretar datas puras.
  const date = new Date(`${isoDate}T00:00:00`);
  return dateFormatter.format(date);
};
