"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchContasBancarias,
  fetchTransacoesContaDigital
} from "@/lib/api/conta-digital.api";

export function useContasBancarias() {
  return useQuery({
    queryKey: queryKeys.contaDigital.contas,
    queryFn: fetchContasBancarias,
    staleTime: 5 * 60_000
  });
}

export function useTransacoesContaDigital(contaId: string | null, limit = 20) {
  return useQuery({
    queryKey: queryKeys.contaDigital.transacoes(contaId ?? ""),
    queryFn: () => fetchTransacoesContaDigital(contaId!, limit),
    enabled: !!contaId
  });
}
