import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(n ?? 0);
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = "dd/MM/yyyy"
): string {
  if (!value) return "-";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "-";
  return format(date, pattern, { locale: ptBR });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function formatCpfCnpj(doc: string | null | undefined): string {
  if (!doc) return "-";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const p = phone.replace(/\D/g, "");
  if (p.length === 11) return p.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (p.length === 10) return p.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null) return "-";
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function truncate(text: string, n = 60): string {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n)}...` : text;
}
