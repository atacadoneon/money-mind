import { api } from "@/lib/api/client";
import type { Categoria } from "@/types";

export async function fetchCategorias(tipo?: "despesa" | "receita"): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>("/categorias", { params: { tipo } });
  return data;
}

export async function createCategoria(payload: Partial<Categoria>): Promise<Categoria> {
  const { data } = await api.post<Categoria>("/categorias", payload);
  return data;
}

export async function updateCategoria(id: string, payload: Partial<Categoria>): Promise<Categoria> {
  const { data } = await api.patch<Categoria>(`/categorias/${id}`, payload);
  return data;
}

export async function deleteCategoria(id: string): Promise<void> {
  await api.delete(`/categorias/${id}`);
}
