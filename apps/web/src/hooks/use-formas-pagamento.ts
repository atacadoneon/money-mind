"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchFormasPagamento,
  createFormaPagamento,
  updateFormaPagamento,
  deleteFormaPagamento
} from "@/lib/api/formas-pagamento.api";
import type { FormaPagamento } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useFormasPagamento() {
  return useQuery({
    queryKey: queryKeys.formasPagamento.all,
    queryFn: fetchFormasPagamento,
    staleTime: 5 * 60_000
  });
}

export function useCreateFormaPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<FormaPagamento>) => createFormaPagamento(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.formasPagamento.all });
      toast.success("Forma de pagamento criada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateFormaPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FormaPagamento> }) =>
      updateFormaPagamento(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.formasPagamento.all });
      toast.success("Forma de pagamento atualizada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteFormaPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFormaPagamento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.formasPagamento.all });
      toast.success("Forma de pagamento removida");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
