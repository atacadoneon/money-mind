import { api } from "@/lib/api/client";
import type { Paginated } from "@/types";

export interface LancamentoCaixa {
  id: string;
  data: string;
  descricao: string;
  tipo: "entrada" | "saida";
  valor: number;
  categoriaId?: string;
  categoriaNome?: string;
  saldoApos: number;
  observacoes?: string;
  criadoEm: string;
}

export interface SaldoCaixa {
  saldoAtual: number;
  totalEntradas: number;
  totalSaidas: number;
  ultimaAtualizacao: string;
}

export async function fetchSaldoCaixa(): Promise<SaldoCaixa> {
  const { data } = await api.get<SaldoCaixa>("/caixa/saldo");
  return data;
}

export async function fetchLancamentosCaixa(
  filters: Record<string, unknown>
): Promise<Paginated<LancamentoCaixa>> {
  const { data } = await api.get<Paginated<LancamentoCaixa>>("/caixa/lancamentos", {
    params: filters
  });
  return data;
}

export async function createLancamentoCaixa(
  payload: Partial<LancamentoCaixa>
): Promise<LancamentoCaixa> {
  const { data } = await api.post<LancamentoCaixa>("/caixa/lancamentos", payload);
  return data;
}

export async function deleteLancamentoCaixa(id: string): Promise<void> {
  await api.delete(`/caixa/lancamentos/${id}`);
}
