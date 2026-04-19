"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchContasReceber,
  fetchContaReceber,
  createContaReceber,
  baixarContaReceber,
  deleteContaReceber
} from "@/lib/api/contas-receber.api";
import type { ContaReceber, ContasReceberFilters } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useContasReceber(filters: ContasReceberFilters) {
  return useQuery({
    queryKey: queryKeys.contasReceber.list(filters as Record<string, unknown>),
    queryFn: () => fetchContasReceber(filters),
    staleTime: 30_000
  });
}

export function useContaReceber(id: string | null) {
  return useQuery({
    queryKey: queryKeys.contasReceber.detail(id ?? ""),
    queryFn: () => fetchContaReceber(id!),
    enabled: !!id
  });
}

export function useCreateContaReceber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ContaReceber>) => createContaReceber(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasReceber.all });
      toast.success("Conta a receber criada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useBaixarContaReceber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      dataRecebimento: string;
      valorRecebido: number;
      formaPagamentoId?: string;
    }) => baixarContaReceber(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasReceber.all });
      toast.success("Recebimento registrado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteContaReceber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContaReceber(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasReceber.all });
      toast.success("Conta removida");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
