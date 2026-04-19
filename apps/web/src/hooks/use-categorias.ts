"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria
} from "@/lib/api/categorias.api";
import type { Categoria } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useCategorias(tipo?: "despesa" | "receita") {
  return useQuery({
    queryKey: [...queryKeys.categorias.all, tipo],
    queryFn: () => fetchCategorias(tipo),
    staleTime: 5 * 60_000
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Categoria>) => createCategoria(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categorias.all });
      toast.success("Categoria criada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Categoria> }) =>
      updateCategoria(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categorias.all });
      toast.success("Categoria atualizada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategoria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categorias.all });
      toast.success("Categoria removida");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
