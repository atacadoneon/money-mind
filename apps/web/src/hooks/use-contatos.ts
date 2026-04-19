"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchContatos,
  fetchContato,
  createContato,
  updateContato,
  deleteContato
} from "@/lib/api/contatos.api";
import type { Contato } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useContatos(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: queryKeys.contatos.list(filters),
    queryFn: () => fetchContatos(filters)
  });
}

export function useContato(id: string | null) {
  return useQuery({
    queryKey: queryKeys.contatos.detail(id ?? ""),
    queryFn: () => fetchContato(id!),
    enabled: !!id
  });
}

export function useCreateContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Contato>) => createContato(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contatos.all });
      toast.success("Contato salvo");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Contato> }) =>
      updateContato(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contatos.all });
      toast.success("Contato atualizado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContato(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contatos.all });
      toast.success("Contato removido");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
