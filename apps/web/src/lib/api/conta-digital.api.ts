import { api } from "@/lib/api/client";

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  agencia?: string;
  contaNumero?: string;
  saldo: number;
  atualizadoEm: string;
}

export interface TransacaoContaDigital {
  id: string;
  contaId: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  saldoApos: number;
}

export async function fetchContasBancarias(): Promise<ContaBancaria[]> {
  const { data } = await api.get<ContaBancaria[]>("/conta-digital/contas");
  return data;
}

export async function fetchTransacoesContaDigital(
  contaId: string,
  limit = 20
): Promise<TransacaoContaDigital[]> {
  const { data } = await api.get<TransacaoContaDigital[]>(
    `/conta-digital/contas/${contaId}/transacoes`,
    { params: { limit } }
  );
  return data;
}
