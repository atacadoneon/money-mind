import { api } from "@/lib/api/client";
import type { Empresa } from "@/types";

export async function fetchCompanies(): Promise<Empresa[]> {
  const { data } = await api.get<Empresa[]>("/empresas");
  return data;
}

export async function fetchCompany(id: string): Promise<Empresa> {
  const { data } = await api.get<Empresa>(`/empresas/${id}`);
  return data;
}

export async function createCompany(payload: Partial<Empresa>): Promise<Empresa> {
  const { data } = await api.post<Empresa>("/empresas", payload);
  return data;
}

export async function updateCompany(id: string, payload: Partial<Empresa>): Promise<Empresa> {
  const { data } = await api.patch<Empresa>(`/empresas/${id}`, payload);
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  await api.delete(`/empresas/${id}`);
}
