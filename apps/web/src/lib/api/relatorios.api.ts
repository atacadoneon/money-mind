import { api } from "@/lib/api/client";

export interface DRERow {
  categoriaId: string;
  categoriaNome: string;
  tipo: "receita" | "despesa";
  total: number;
  percentual: number;
}

export interface DREData {
  periodo: { inicio: string; fim: string };
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  linhas: DRERow[];
}

export interface FluxoCaixaItem {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

export interface ContasPorCategoria {
  categoriaId: string;
  categoriaNome: string;
  total: number;
  quantidade: number;
}

export interface TopContatoItem {
  contatoId: string;
  contatoNome: string;
  total: number;
  quantidade: number;
}

export async function fetchRelatorioDRE(params: {
  empresaId?: string;
  inicio: string;
  fim: string;
}): Promise<DREData> {
  const { data } = await api.get<DREData>("/relatorios/dre", { params });
  return data;
}

export async function fetchRelatorioFluxoCaixa(params: {
  dias: 30 | 60 | 90;
  empresaId?: string;
}): Promise<FluxoCaixaItem[]> {
  const { data } = await api.get<FluxoCaixaItem[]>("/relatorios/fluxo-caixa", { params });
  return data;
}

export async function fetchRelatorioContasPorCategoria(params: {
  tipo: "despesa" | "receita";
  inicio: string;
  fim: string;
  empresaId?: string;
}): Promise<ContasPorCategoria[]> {
  const { data } = await api.get<ContasPorCategoria[]>("/relatorios/contas-por-categoria", {
    params
  });
  return data;
}

export async function fetchRelatorioTopContatos(params: {
  tipo: "fornecedor" | "cliente";
  inicio: string;
  fim: string;
  empresaId?: string;
}): Promise<TopContatoItem[]> {
  const { data } = await api.get<TopContatoItem[]>("/relatorios/top-contatos", { params });
  return data;
}
