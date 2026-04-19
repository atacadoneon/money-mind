export const FORMA_PAGAMENTO_TIPOS = [
  'dinheiro',
  'pix',
  'boleto',
  'cartao_credito',
  'cartao_debito',
  'ted',
  'doc',
  'cheque',
  'deposito',
  'transferencia',
  'gateway',
  'outro',
] as const;
export type FormaPagamentoTipo = (typeof FORMA_PAGAMENTO_TIPOS)[number];
