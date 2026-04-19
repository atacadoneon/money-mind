/** Valida CEP brasileiro: 8 dígitos (aceita XXXXX-XXX). */
export function isValidCep(input: string): boolean {
  return /^\d{5}-?\d{3}$/.test((input ?? '').trim());
}

/** Formata CEP como XXXXX-XXX. */
export function formatCep(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length < 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/** Remove máscara do CEP. */
export function unmaskCep(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}
