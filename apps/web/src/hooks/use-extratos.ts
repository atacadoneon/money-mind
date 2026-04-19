"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchExtratos,
  fetchExtratoLinhas,
  uploadExtratoOfx,
  matchLinha
} from "@/lib/api/extratos.api";
import { extractApiError } from "@/lib/api/client";

export function useExtratos(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.extratos.list(filters),
    queryFn: () => fetchExtratos(filters)
  });
}

export function useExtratoLinhas(extratoId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.extratos.all, "linhas", extratoId],
    queryFn: () => fetchExtratoLinhas(extratoId!),
    enabled: !!extratoId
  });
}

export function useUploadExtratoOfx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadExtratoOfx(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.extratos.all });
      toast.success("Extrato importado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useMatchLinha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      linhaId,
      titleId,
      tipo
    }: {
      linhaId: string;
      titleId: string;
      tipo: "pagar" | "receber";
    }) => matchLinha(linhaId, titleId, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.extratos.all });
      toast.success("Linha conciliada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
