import { api } from "@/lib/api/client";
import type { ContaPagar, ContasPagarFilters, Paginated } from "@/types";

export async function fetchContasPagar(filters: ContasPagarFilters): Promise<Paginated<ContaPagar>> {
  const { data } = await api.get<Paginated<ContaPagar>>("/contas-pagar", { params: filters });
  return data;
}

export async function fetchContaPagar(id: string): Promise<ContaPagar> {
  const { data } = await api.get<ContaPagar>(`/contas-pagar/${id}`);
  return data;
}

export async function createContaPagar(payload: Partial<ContaPagar>): Promise<ContaPagar> {
  const { data } = await api.post<ContaPagar>("/contas-pagar", payload);
  return data;
}

export async function updateContaPagar(id: string, payload: Partial<ContaPagar>): Promise<ContaPagar> {
  const { data } = await api.patch<ContaPagar>(`/contas-pagar/${id}`, payload);
  return data;
}

export async function baixarContaPagar(
  id: string,
  payload: { dataPagamento: string; valorPago: number; formaPagamentoId?: string; observacoes?: string }
): Promise<ContaPagar> {
  const { data } = await api.post<ContaPagar>(`/contas-pagar/${id}/baixar`, payload);
  return data;
}

export async function bulkBaixarContasPagar(ids: string[], dataPagamento: string): Promise<{ ok: number }> {
  const { data } = await api.post<{ ok: number }>(`/contas-pagar/bulk-baixar`, { ids, dataPagamento });
  return data;
}

export async function bulkUpdateCategoria(ids: string[], categoriaId: string): Promise<{ ok: number }> {
  const { data } = await api.post<{ ok: number }>(`/contas-pagar/bulk-categoria`, { ids, categoriaId });
  return data;
}

export async function deleteContaPagar(id: string): Promise<void> {
  await api.delete(`/contas-pagar/${id}`);
}

export async function exportContasPagar(filters: ContasPagarFilters, formato: "xlsx" | "csv"): Promise<Blob> {
  const { data } = await api.get(`/contas-pagar/export`, {
    params: { ...filters, formato },
    responseType: "blob"
  });
  return data as Blob;
}
