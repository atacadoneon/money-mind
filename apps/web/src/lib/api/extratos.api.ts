import { api } from "@/lib/api/client";
import type { ExtratoBancario, ExtratoLinha, Paginated } from "@/types";

export async function fetchExtratos(filters: Record<string, unknown>): Promise<Paginated<ExtratoBancario>> {
  const { data } = await api.get<Paginated<ExtratoBancario>>("/extratos", { params: filters });
  return data;
}

export async function fetchExtratoLinhas(extratoId: string): Promise<ExtratoLinha[]> {
  const { data } = await api.get<ExtratoLinha[]>(`/extratos/${extratoId}/linhas`);
  return data;
}

export async function uploadExtratoOfx(file: File): Promise<ExtratoBancario> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<ExtratoBancario>("/extratos/upload-ofx", fd, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function matchLinha(linhaId: string, titleId: string, tipo: "pagar" | "receber") {
  const { data } = await api.post(`/extratos/linhas/${linhaId}/match`, { titleId, tipo });
  return data;
}
