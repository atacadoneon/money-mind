export interface ContaBancariaSeed {
  company_slug: string;
  banco_codigo: string | null;
  banco_nome: string;
  agencia: string | null;
  conta_numero: string | null;
  tipo: 'corrente' | 'poupanca' | 'pagamento' | 'cartao_credito' | 'gateway' | 'caixa';
  nome: string;
  tiny_conta_origem: string;
  source_type: 'ofx' | 'api' | 'csv' | 'manual';
  gateway_provider: string | null;
  cor: string;
}

export const CONTAS_BANCARIAS_SEED: ContaBancariaSeed[] = [
  // BlueLight
  {
    company_slug: 'bluelight',
    banco_codigo: '756',
    banco_nome: 'Sicoob',
    agencia: null,
    conta_numero: null,
    tipo: 'corrente',
    nome: 'Sicoob - BlueLight',
    tiny_conta_origem: 'Sicoob - BlueLight',
    source_type: 'ofx',
    gateway_provider: 'sicoob',
    cor: '#0A9E4C',
  },
  {
    company_slug: 'bluelight',
    banco_codigo: null,
    banco_nome: 'AppMax',
    agencia: null,
    conta_numero: null,
    tipo: 'gateway',
    nome: 'AppMax - BlueLight',
    tiny_conta_origem: 'AppMax',
    source_type: 'api',
    gateway_provider: 'appmax',
    cor: '#F97316',
  },
  {
    company_slug: 'bluelight',
    banco_codigo: null,
    banco_nome: 'Olist Digital',
    agencia: null,
    conta_numero: null,
    tipo: 'gateway',
    nome: 'Olist Digital - BlueLight',
    tiny_conta_origem: 'Olist Digital',
    source_type: 'api',
    gateway_provider: 'olist',
    cor: '#7C3AED',
  },

  // Industrias Neon
  {
    company_slug: 'industrias-neon',
    banco_codigo: '756',
    banco_nome: 'Sicoob',
    agencia: null,
    conta_numero: null,
    tipo: 'corrente',
    nome: 'Sicoob - Industrias Neon',
    tiny_conta_origem: 'Sicoob - Industrias Neon',
    source_type: 'ofx',
    gateway_provider: 'sicoob',
    cor: '#0A9E4C',
  },
  {
    company_slug: 'industrias-neon',
    banco_codigo: null,
    banco_nome: 'Olist Digital',
    agencia: null,
    conta_numero: null,
    tipo: 'gateway',
    nome: 'Olist Digital - Industrias Neon',
    tiny_conta_origem: 'Olist Digital',
    source_type: 'api',
    gateway_provider: 'olist',
    cor: '#7C3AED',
  },

  // Atacado Neon
  {
    company_slug: 'atacado-neon',
    banco_codigo: '756',
    banco_nome: 'Sicoob',
    agencia: null,
    conta_numero: null,
    tipo: 'corrente',
    nome: 'Sicoob - Atacado Neon',
    tiny_conta_origem: 'Sicoob - Atacado Neon',
    source_type: 'ofx',
    gateway_provider: 'sicoob',
    cor: '#0A9E4C',
  },
  {
    company_slug: 'atacado-neon',
    banco_codigo: null,
    banco_nome: 'Conta Simples',
    agencia: null,
    conta_numero: null,
    tipo: 'cartao_credito',
    nome: 'Conta Simples - Atacado Neon',
    tiny_conta_origem: 'Conta Simples',
    source_type: 'api',
    gateway_provider: 'conta_simples',
    cor: '#1E293B',
  },

  // Engagge Placas
  {
    company_slug: 'engagge-placas',
    banco_codigo: '756',
    banco_nome: 'Sicoob',
    agencia: null,
    conta_numero: null,
    tipo: 'corrente',
    nome: 'Sicoob - Engagge',
    tiny_conta_origem: 'Sicoob - Engagge',
    source_type: 'ofx',
    gateway_provider: 'sicoob',
    cor: '#0A9E4C',
  },

  // RYU Biotech
  {
    company_slug: 'ryu-biotech',
    banco_codigo: '756',
    banco_nome: 'Sicoob',
    agencia: null,
    conta_numero: null,
    tipo: 'corrente',
    nome: 'Sicoob - RYU',
    tiny_conta_origem: 'Sicoob - RYU',
    source_type: 'ofx',
    gateway_provider: 'sicoob',
    cor: '#0A9E4C',
  },
];
