import { api } from "@/lib/api/client";
import type { FormaPagamento } from "@/types";

export async function fetchFormasPagamento(): Promise<FormaPagamento[]> {
  const { data } = await api.get<FormaPagamento[]>("/formas-pagamento");
  return data;
}

export async function createFormaPagamento(
  payload: Partial<FormaPagamento>
): Promise<FormaPagamento> {
  const { data } = await api.post<FormaPagamento>("/formas-pagamento", payload);
  return data;
}

export async function updateFormaPagamento(
  id: string,
  payload: Partial<FormaPagamento>
): Promise<FormaPagamento> {
  const { data } = await api.patch<FormaPagamento>(`/formas-pagamento/${id}`, payload);
  return data;
}

export async function deleteFormaPagamento(id: string): Promise<void> {
  await api.delete(`/formas-pagamento/${id}`);
}
