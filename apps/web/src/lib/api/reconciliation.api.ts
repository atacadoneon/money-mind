import { api } from "@/lib/api/client";

export interface ReconciliationSuggestion {
  linhaId: string;
  titleId: string;
  tipo: "pagar" | "receber";
  confidence: number;
  contatoNome: string;
  descricaoLinha: string;
  valor: number;
  dataLinha: string;
  dataVencimento: string;
}

export interface ConfirmMatchPayload {
  linhaId: string;
  titleId: string;
  tipo: "pagar" | "receber";
}

export async function fetchReconciliationSuggestions(
  extratoId: string
): Promise<ReconciliationSuggestion[]> {
  const { data } = await api.get<ReconciliationSuggestion[]>(
    `/reconciliation/suggestions/${extratoId}`
  );
  return data;
}

export async function confirmMatch(payload: ConfirmMatchPayload): Promise<void> {
  await api.post("/reconciliation/confirm", payload);
}

export async function ignoreMatch(linhaId: string): Promise<void> {
  await api.post(`/reconciliation/ignore/${linhaId}`);
}

export async function runReconciliationJob(extratoId: string): Promise<{ jobId: string }> {
  const { data } = await api.post<{ jobId: string }>(
    `/reconciliation/run?extrato_id=${extratoId}`
  );
  return data;
}

export async function pollReconciliationStatus(
  jobId: string
): Promise<{ status: "pending" | "running" | "done" | "error"; progress?: number }> {
  const { data } = await api.get<{ status: "pending" | "running" | "done" | "error"; progress?: number }>(
    `/reconciliation/status/${jobId}`
  );
  return data;
}
