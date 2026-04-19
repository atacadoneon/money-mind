export const SITUACAO_CP = [
  'aberto',
  'emitido',
  'pago',
  'parcial',
  'atrasado',
  'cancelado',
] as const;
export type SituacaoCP = (typeof SITUACAO_CP)[number];

export const SITUACAO_CR = [
  'aberto',
  'emitido',
  'previsto',
  'recebido',
  'parcial',
  'atrasado',
  'cancelado',
] as const;
export type SituacaoCR = (typeof SITUACAO_CR)[number];

export const SITUACAO_COBRANCA = [
  'rascunho',
  'registrado',
  'enviado',
  'pago',
  'vencido',
  'protestado',
  'baixado',
  'cancelado',
  'rejeitado',
] as const;
export type SituacaoCobranca = (typeof SITUACAO_COBRANCA)[number];

export const SITUACAO_CONTATO = ['ativo', 'inativo'] as const;
export type SituacaoContato = (typeof SITUACAO_CONTATO)[number];
