/**
 * Formata número como moeda BRL: R$ 1.234,56
 */
export function formatCurrency(value: number | string | null | undefined, currency = 'BRL'): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse string "R$ 1.234,56" ou "1234,56" ou "1234.56" -> número em centavos inteiros não é feito;
 * retorna number float. Útil quando recebendo de planilha.
 */
export function parseCurrency(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return input;
  const cleaned = input
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Arredonda para 2 casas decimais com precisão financeira.
 * Evita o "erro do 0.1 + 0.2".
 */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Converte NUMERIC(14,2) string do Postgres para number.
 */
export function pgNumericToNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}
