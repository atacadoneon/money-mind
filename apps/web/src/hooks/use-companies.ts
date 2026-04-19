"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchCompanies,
  fetchCompany,
  createCompany,
  updateCompany,
  deleteCompany
} from "@/lib/api/companies.api";
import type { Empresa } from "@/types";
import { extractApiError } from "@/lib/api/client";

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.empresas.all,
    queryFn: fetchCompanies,
    staleTime: 5 * 60_000
  });
}

export function useCompany(id: string | null) {
  return useQuery({
    queryKey: queryKeys.empresas.detail(id ?? ""),
    queryFn: () => fetchCompany(id!),
    enabled: !!id
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Empresa>) => createCompany(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.empresas.all });
      toast.success("Empresa criada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Empresa> }) =>
      updateCompany(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.empresas.all });
      toast.success("Empresa atualizada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.empresas.all });
      toast.success("Empresa removida");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
