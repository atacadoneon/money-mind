/**
 * Formata Date/string ISO como dd/MM/yyyy.
 */
export function formatDate(input: Date | string | null | undefined): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** dd/MM/yyyy HH:mm */
export function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** yyyy-MM-dd (ISO date only). */
export function toIsoDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 10);
}

/** Parse dd/MM/yyyy -> Date. */
export function parseDateBr(input: string): Date | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Retorna diferença em dias (b - a). */
export function diffDays(a: Date | string, b: Date | string): number {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Adiciona dias a uma data. */
export function addDays(input: Date | string, days: number): Date {
  const d = input instanceof Date ? new Date(input) : new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

/** Retorna true se a data está vencida (antes de hoje, inclusivo=false). */
export function isVencida(dataVencimento: Date | string): boolean {
  const v = dataVencimento instanceof Date ? dataVencimento : new Date(dataVencimento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  v.setHours(0, 0, 0, 0);
  return v.getTime() < hoje.getTime();
}
