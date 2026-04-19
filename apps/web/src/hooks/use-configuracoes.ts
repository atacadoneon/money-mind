"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchIntegracoes,
  saveIntegracoes,
  fetchMembros,
  inviteMembro,
  updateMembroRole,
  removeMembro,
  fetchPreferences,
  savePreferences,
  type IntegracaoConfig,
  type OrgPreferences,
  type UserMembro
} from "@/lib/api/configuracoes.api";
import { extractApiError } from "@/lib/api/client";

export function useIntegracoes() {
  return useQuery({
    queryKey: queryKeys.configuracoes.integracoes,
    queryFn: fetchIntegracoes
  });
}

export function useSaveIntegracoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<IntegracaoConfig>) => saveIntegracoes(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configuracoes.integracoes });
      toast.success("Integrações salvas");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useMembros() {
  return useQuery({
    queryKey: queryKeys.configuracoes.membros,
    queryFn: fetchMembros
  });
}

export function useInviteMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserMembro["role"] }) =>
      inviteMembro(email, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configuracoes.membros });
      toast.success("Convite enviado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useUpdateMembroRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserMembro["role"] }) =>
      updateMembroRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configuracoes.membros });
      toast.success("Papel atualizado");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useRemoveMembro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeMembro(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configuracoes.membros });
      toast.success("Membro removido");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: queryKeys.configuracoes.preferences,
    queryFn: fetchPreferences
  });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<OrgPreferences>) => savePreferences(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.configuracoes.preferences });
      toast.success("Preferências salvas");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}
