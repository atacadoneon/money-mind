"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanCard } from "@/components/billing/PlanCard";
import { usePlans, useSubscription, useCreateCheckout } from "@/hooks/use-billing";
import type { PlanSlug } from "@/lib/api/billing.api";

const FALLBACK_PLANS = [
  {
    id: "1",
    slug: "starter" as PlanSlug,
    name: "Starter",
    priceBrl: 49,
    billingCycle: "monthly" as const,
    trialDays: 14,
    features: {
      max_empresas: 3,
      max_transacoes_mes: 5000,
      mcps_ativos: ["tiny"],
      ai_enabled: false,
      relatorios_avancados: false,
      suporte_prioritario: false,
      api_access: false,
      trial_days: 14,
    },
  },
  {
    id: "2",
    slug: "pro" as PlanSlug,
    name: "Pro",
    priceBrl: 149,
    billingCycle: "monthly" as const,
    trialDays: 14,
    features: {
      max_empresas: 10,
      max_transacoes_mes: 30000,
      mcps_ativos: ["tiny", "bancos"],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: false,
      api_access: false,
      trial_days: 14,
    },
  },
  {
    id: "3",
    slug: "business" as PlanSlug,
    name: "Business",
    priceBrl: 449,
    billingCycle: "monthly" as const,
    trialDays: 14,
    features: {
      max_empresas: 999,
      max_transacoes_mes: 999999,
      mcps_ativos: ["tiny", "bancos", "gateways", "comunicacao"],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: true,
      api_access: true,
      trial_days: 14,
    },
  },
  {
    id: "4",
    slug: "enterprise" as PlanSlug,
    name: "Enterprise",
    priceBrl: 0,
    billingCycle: "monthly" as const,
    trialDays: 30,
    features: {
      max_empresas: 999,
      max_transacoes_mes: 999999,
      mcps_ativos: ["tiny", "bancos", "gateways", "comunicacao"],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: true,
      api_access: true,
      trial_days: 30,
    },
  },
];

export default function PlanosPage() {
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: sub } = useSubscription();
  const checkout = useCreateCheckout();
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = React.useState<PlanSlug | null>(null);

  const displayPlans = plans && plans.length > 0 ? plans : FALLBACK_PLANS;

  const handleSelect = async (plan: PlanSlug) => {
    if (plan === "enterprise") {
      window.open("https://moneymind.com.br/contato", "_blank");
      return;
    }
    setLoadingPlan(plan);
    try {
      await checkout.mutateAsync({ plan, cycle });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Planos e Preços"
        description="Escolha o plano ideal para sua operação financeira"
      />

      <div className="p-6">
        {/* Billing cycle toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1">
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCycle("monthly")}
            >
              Mensal
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${cycle === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCycle("yearly")}
            >
              Anual
              <span className="ml-1.5 text-xs text-green-600 font-semibold">-20%</span>
            </button>
          </div>
        </div>

        {plansLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {displayPlans.map((plan) => (
              <PlanCard
                key={plan.slug}
                plan={plan}
                currentPlan={sub?.plan}
                cycle={cycle}
                onSelect={handleSelect}
                loading={loadingPlan === plan.slug}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Todos os planos incluem trial de 14 dias grátis. Cancele a qualquer momento.
          <br />
          Preços em BRL. Cobrados via Stripe com cartão de crédito ou boleto.
        </p>
      </div>
    </>
  );
}
