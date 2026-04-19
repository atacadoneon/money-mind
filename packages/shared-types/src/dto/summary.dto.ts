export interface CpSummary {
  todas: number;
  em_aberto: number;
  emitidas: number;
  pagas: number;
  atrasadas: number;
  canceladas: number;
  valor_total: number;
}

export interface CrSummary {
  em_aberto: number;
  emitidas: number;
  previstas: number;
  recebidas: number;
  atrasadas: number;
  canceladas: number;
  valor_total: number;
}

export interface ExtratoSummary {
  creditos: number;
  debitos: number;
  saldo: number;
  pendentes: number;
}
