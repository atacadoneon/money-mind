import { api } from "@/lib/api/client";
import type { Contato, Paginated } from "@/types";

export async function fetchContatos(filters: Record<string, unknown>): Promise<Paginated<Contato>> {
  const { data } = await api.get<Paginated<Contato>>("/contatos", { params: filters });
  return data;
}

export async function fetchContato(id: string): Promise<Contato> {
  const { data } = await api.get<Contato>(`/contatos/${id}`);
  return data;
}

export async function createContato(payload: Partial<Contato>): Promise<Contato> {
  const { data } = await api.post<Contato>("/contatos", payload);
  return data;
}

export async function updateContato(id: string, payload: Partial<Contato>): Promise<Contato> {
  const { data } = await api.patch<Contato>(`/contatos/${id}`, payload);
  return data;
}

export async function deleteContato(id: string): Promise<void> {
  await api.delete(`/contatos/${id}`);
}
