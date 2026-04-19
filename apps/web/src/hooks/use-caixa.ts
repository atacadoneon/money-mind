"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchSaldoCaixa,
  fetchLancamentosCaixa,
  createLancamentoCaixa,
  deleteLancamentoCaixa,
  type LancamentoCaixa
} from "@/lib/api/caixa.api";
import { extractApiError } from "@/lib/api/client";

export function useSaldoCaixa() {
  return useQuery({
    queryKey: queryKeys.caixa.saldo,
    queryFn: fetchSaldoCaixa,
    refetchInterval: 60_000
  });
}

export function useLancamentosCaixa(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.caixa.list(filters),
    queryFn: () => fetchLancamentosCaixa(filters)
  });
}

export function useCreateLancamentoCaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<LancamentoCaixa>) => createLancamentoCaixa(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.caixa.all });
      toast.success("Lançamento criado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteLancamentoCaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLancamentoCaixa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.caixa.all });
      toast.success("Lançamento excluído");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
