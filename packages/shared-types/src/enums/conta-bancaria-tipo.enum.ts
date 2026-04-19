export const CONTA_BANCARIA_TIPOS = [
  'corrente',
  'poupanca',
  'pagamento',
  'cartao_credito',
  'gateway',
  'caixa',
] as const;
export type ContaBancariaTipo = (typeof CONTA_BANCARIA_TIPOS)[number];

export const CONTA_BANCARIA_SOURCES = ['ofx', 'api', 'csv', 'manual'] as const;
export type ContaBancariaSource = (typeof CONTA_BANCARIA_SOURCES)[number];

export const EXTRATO_TIPOS = ['credito', 'debito'] as const;
export type ExtratoTipo = (typeof EXTRATO_TIPOS)[number];
