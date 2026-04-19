"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchContasPagar,
  fetchContaPagar,
  createContaPagar,
  updateContaPagar,
  baixarContaPagar,
  bulkBaixarContasPagar,
  bulkUpdateCategoria,
  deleteContaPagar
} from "@/lib/api/contas-pagar.api";
import type { ContaPagar, ContasPagarFilters } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useContasPagar(filters: ContasPagarFilters) {
  return useQuery({
    queryKey: queryKeys.contasPagar.list(filters as Record<string, unknown>),
    queryFn: () => fetchContasPagar(filters),
    staleTime: 30_000
  });
}

export function useContaPagar(id: string | null) {
  return useQuery({
    queryKey: queryKeys.contasPagar.detail(id ?? ""),
    queryFn: () => fetchContaPagar(id!),
    enabled: !!id
  });
}

export function useCreateContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ContaPagar>) => createContaPagar(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success("Conta a pagar criada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ContaPagar> }) =>
      updateContaPagar(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success("Conta atualizada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useBaixarContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      dataPagamento: string;
      valorPago: number;
      formaPagamentoId?: string;
      observacoes?: string;
    }) => baixarContaPagar(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success("Pagamento registrado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useBulkBaixarContasPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, dataPagamento }: { ids: string[]; dataPagamento: string }) =>
      bulkBaixarContasPagar(ids, dataPagamento),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success(`${r.ok} contas baixadas`);
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useBulkUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, categoriaId }: { ids: string[]; categoriaId: string }) =>
      bulkUpdateCategoria(ids, categoriaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success("Categoria alterada em lote");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContaPagar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contasPagar.all });
      toast.success("Conta removida");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
