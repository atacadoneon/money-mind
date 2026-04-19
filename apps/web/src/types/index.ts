export type SituacaoCP = "aberto" | "pago" | "parcial" | "atrasado" | "cancelado";
export type SituacaoCR = "aberto" | "recebido" | "parcial" | "atrasado" | "cancelado";

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  avatarColor?: string;
}

export interface Contato {
  id: string;
  nome: string;
  nomeFantasia?: string;
  tipoPessoa: string;
  tipos: string[];
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  situacao: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: "despesa" | "receita";
  cor?: string | null;
  parentId?: string | null;
  isActive: boolean;
}

export interface FormaPagamento {
  id: string;
  nome: string;
  tipo: string;
  isActive: boolean;
}

export interface ContaPagar {
  id: string;
  contatoId?: string | null;
  contatoNome?: string | null;
  historico?: string | null;
  categoriaId?: string | null;
  dataEmissao?: string | null;
  dataVencimento: string;
  dataPagamento?: string | null;
  valor: string;
  valorPago: string;
  situacao: SituacaoCP;
  formaPagamentoId?: string | null;
  contaBancariaId?: string | null;
  marcadores: string[];
  observacoes?: string;
  numeroDocumento?: string;
  orgId: string;
  companyId: string;
}

export interface ContaReceber {
  id: string;
  contatoId?: string | null;
  contatoNome?: string | null;
  historico?: string | null;
  categoriaId?: string | null;
  dataEmissao?: string | null;
  dataVencimento: string;
  dataRecebimento?: string | null;
  valor: string;
  valorRecebido: string;
  situacao: SituacaoCR;
  formaPagamentoId?: string | null;
  contaBancariaId?: string | null;
  marcadores: string[];
  observacoes?: string;
  numeroDocumento?: string;
  orgId: string;
  companyId: string;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  tipo: string;
  bancoCodigo?: string;
  bancoNome?: string;
  agencia?: string;
  contaNumero?: string;
  saldoInicial: string;
  saldoAtual: string;
  isActive: boolean;
}

export interface ExtratoBancario {
  id: string;
  bancoNome: string;
  contaNumero: string;
  /** @deprecated Use contaNumero */
  conta?: string;
  dataInicio: string;
  dataFim: string;
  saldoInicial: number;
  saldoFinal: number;
  linhasTotal: number;
  linhasConciliadas: number;
  status: "importado" | "em_conciliacao" | "conciliado";
  criadoEm: string;
}

export interface ExtratoLinha {
  id: string;
  extratoId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  status: "pendente" | "conciliado" | "ignorado";
  matchId?: string | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContasPagarFilters {
  search?: string;
  situacao?: SituacaoCP | "todas";
  contatoId?: string;
  categoriaId?: string;
  formaPagamentoId?: string;
  vencimentoFrom?: string;
  vencimentoTo?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  valorMin?: number;
  valorMax?: number;
  marcador?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  order_by?: string;
  order_dir?: "asc" | "desc";
}

export type ContasReceberFilters = Omit<ContasPagarFilters, "situacao"> & {
  situacao?: SituacaoCR | "todas";
};

export interface Marcador {
  id: string;
  descricao: string;
  cor: string;
}
