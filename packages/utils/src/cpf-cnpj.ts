/** Remove tudo que não é dígito. */
export function onlyDigits(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Valida CPF (11 dígitos). */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]!, 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cpf[9]!, 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]!, 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(cpf[10]!, 10);
}

/** Valida CNPJ (14 dígitos). */
export function isValidCnpj(input: string): boolean {
  const cnpj = onlyDigits(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let soma = pesos1.reduce((s, p, i) => s + parseInt(cnpj[i]!, 10) * p, 0);
  let dig = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (dig !== parseInt(cnpj[12]!, 10)) return false;

  soma = pesos2.reduce((s, p, i) => s + parseInt(cnpj[i]!, 10) * p, 0);
  dig = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return dig === parseInt(cnpj[13]!, 10);
}

/** Valida CPF ou CNPJ automaticamente pelo comprimento. */
export function isValidCpfCnpj(input: string): boolean {
  const v = onlyDigits(input);
  if (v.length === 11) return isValidCpf(v);
  if (v.length === 14) return isValidCnpj(v);
  return false;
}

/** Formata CPF: 123.456.789-09 */
export function formatCpf(input: string): string {
  const v = onlyDigits(input).padStart(11, '0').slice(0, 11);
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
}

/** Formata CNPJ: 12.345.678/0001-95 */
export function formatCnpj(input: string): string {
  const v = onlyDigits(input).padStart(14, '0').slice(0, 14);
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12, 14)}`;
}

export function formatCpfCnpj(input: string): string {
  const v = onlyDigits(input);
  if (v.length === 11) return formatCpf(v);
  if (v.length === 14) return formatCnpj(v);
  return input;
}
