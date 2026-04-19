export interface FormaPagamentoSeed {
  nome: string;
  tipo:
    | 'dinheiro'
    | 'pix'
    | 'boleto'
    | 'cartao_credito'
    | 'cartao_debito'
    | 'ted'
    | 'doc'
    | 'cheque'
    | 'deposito'
    | 'transferencia'
    | 'gateway'
    | 'outro';
  icone: string;
  cor: string;
  taxa_percentual: number;
  taxa_fixa: number;
  prazo_recebimento_dias: number;
}

export const FORMAS_PAGAMENTO_SEED: FormaPagamentoSeed[] = [
  {
    nome: 'PIX',
    tipo: 'pix',
    icone: 'qr-code',
    cor: '#22C55E',
    taxa_percentual: 0,
    taxa_fixa: 0,
    prazo_recebimento_dias: 0,
  },
  {
    nome: 'Boleto',
    tipo: 'boleto',
    icone: 'barcode',
    cor: '#3B82F6',
    taxa_percentual: 0,
    taxa_fixa: 3.5,
    prazo_recebimento_dias: 2,
  },
  {
    nome: 'TED',
    tipo: 'ted',
    icone: 'arrow-left-right',
    cor: '#64748B',
    taxa_percentual: 0,
    taxa_fixa: 10,
    prazo_recebimento_dias: 0,
  },
  {
    nome: 'Cartão de Crédito',
    tipo: 'cartao_credito',
    icone: 'credit-card',
    cor: '#F59E0B',
    taxa_percentual: 3.5,
    taxa_fixa: 0,
    prazo_recebimento_dias: 30,
  },
  {
    nome: 'Cartão de Débito',
    tipo: 'cartao_debito',
    icone: 'credit-card',
    cor: '#F59E0B',
    taxa_percentual: 1.5,
    taxa_fixa: 0,
    prazo_recebimento_dias: 1,
  },
  {
    nome: 'Dinheiro',
    tipo: 'dinheiro',
    icone: 'banknote',
    cor: '#16A34A',
    taxa_percentual: 0,
    taxa_fixa: 0,
    prazo_recebimento_dias: 0,
  },
];
