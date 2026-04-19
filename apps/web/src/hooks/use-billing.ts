"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchSubscription,
  fetchPlans,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  applyCoupon,
  type PlanSlug,
} from "@/lib/api/billing.api";

const KEYS = {
  subscription: ["billing", "subscription"] as const,
  plans: ["billing", "plans"] as const,
};

export function useSubscription() {
  return useQuery({
    queryKey: KEYS.subscription,
    queryFn: fetchSubscription,
    staleTime: 60 * 1000, // 1 min
  });
}

export function usePlans() {
  return useQuery({
    queryKey: KEYS.plans,
    queryFn: fetchPlans,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ plan, cycle }: { plan: PlanSlug; cycle?: "monthly" | "yearly" }) =>
      createCheckoutSession(plan, cycle),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => {
      toast.error("Erro ao criar sessão de pagamento. Tente novamente.");
    },
  });
}

export function useCreatePortal() {
  return useMutation({
    mutationFn: createPortalSession,
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: () => {
      toast.error("Erro ao acessar portal de cobrança.");
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: KEYS.subscription });
    },
    onError: () => {
      toast.error("Erro ao cancelar assinatura.");
    },
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => applyCoupon(code),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: KEYS.subscription });
    },
    onError: () => {
      toast.error("Cupom inválido ou expirado.");
    },
  });
}

// ─── Computed helpers ─────────────────────────────────────────────────────────

export function useIsTrialing() {
  const { data } = useSubscription();
  return data?.status === "trialing";
}

export function useTrialDaysLeft() {
  const { data } = useSubscription();
  if (!data?.trialEnd) return 0;
  const ms = new Date(data.trialEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
