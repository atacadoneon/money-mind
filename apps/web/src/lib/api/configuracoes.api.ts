import { api } from "@/lib/api/client";

export interface IntegracaoConfig {
  tinyApiToken?: string;
  contaSimplesToken?: string;
  pagarMeApiKey?: string;
  pagarMeEncryptionKey?: string;
}

export interface UserMembro {
  id: string;
  email: string;
  nome: string;
  role: "owner" | "admin" | "accountant" | "viewer";
  ativo: boolean;
  criadoEm: string;
}

export interface OrgPreferences {
  tema: "light" | "dark" | "system";
  idioma: string;
  formatoData: string;
}

export async function fetchIntegracoes(): Promise<IntegracaoConfig> {
  const { data } = await api.get<IntegracaoConfig>("/configuracoes/integracoes");
  return data;
}

export async function saveIntegracoes(payload: Partial<IntegracaoConfig>): Promise<void> {
  await api.patch("/configuracoes/integracoes", payload);
}

export async function fetchMembros(): Promise<UserMembro[]> {
  const { data } = await api.get<UserMembro[]>("/configuracoes/membros");
  return data;
}

export async function inviteMembro(email: string, role: UserMembro["role"]): Promise<void> {
  await api.post("/configuracoes/membros/invite", { email, role });
}

export async function updateMembroRole(id: string, role: UserMembro["role"]): Promise<void> {
  await api.patch(`/configuracoes/membros/${id}`, { role });
}

export async function removeMembro(id: string): Promise<void> {
  await api.delete(`/configuracoes/membros/${id}`);
}

export async function fetchPreferences(): Promise<OrgPreferences> {
  const { data } = await api.get<OrgPreferences>("/configuracoes/preferencias");
  return data;
}

export async function savePreferences(payload: Partial<OrgPreferences>): Promise<void> {
  await api.patch("/configuracoes/preferencias", payload);
}
