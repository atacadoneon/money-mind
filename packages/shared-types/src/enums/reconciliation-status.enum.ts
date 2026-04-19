export const RECONCILIATION_STATUS = [
  'pending',
  'suggested',
  'reconciled',
  'ignored',
  'reversed',
  'transfer',
] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUS)[number];

export const RECONCILIATION_METODO = ['auto', 'ai', 'manual', 'rule', 'pattern'] as const;
export type ReconciliationMetodo = (typeof RECONCILIATION_METODO)[number];

export const RECONCILIATION_TIPO_MATCH = ['1:1', '1:N', 'N:1', 'N:N', 'manual', 'transfer'] as const;
export type ReconciliationTipoMatch = (typeof RECONCILIATION_TIPO_MATCH)[number];
