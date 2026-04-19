import { api } from "@/lib/api/client";
import type { ContaReceber, ContasReceberFilters, Paginated } from "@/types";

export async function fetchContasReceber(filters: ContasReceberFilters): Promise<Paginated<ContaReceber>> {
  const { data } = await api.get<Paginated<ContaReceber>>("/contas-receber", { params: filters });
  return data;
}

export async function fetchContaReceber(id: string): Promise<ContaReceber> {
  const { data } = await api.get<ContaReceber>(`/contas-receber/${id}`);
  return data;
}

export async function createContaReceber(payload: Partial<ContaReceber>): Promise<ContaReceber> {
  const { data } = await api.post<ContaReceber>("/contas-receber", payload);
  return data;
}

export async function baixarContaReceber(
  id: string,
  payload: { dataRecebimento: string; valorRecebido: number; formaPagamentoId?: string }
): Promise<ContaReceber> {
  const { data } = await api.post<ContaReceber>(`/contas-receber/${id}/baixar`, payload);
  return data;
}

export async function deleteContaReceber(id: string): Promise<void> {
  await api.delete(`/contas-receber/${id}`);
}
