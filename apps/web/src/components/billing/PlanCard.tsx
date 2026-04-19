"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanDetails, PlanSlug } from "@/lib/api/billing.api";

interface PlanCardProps {
  plan: PlanDetails;
  currentPlan?: PlanSlug;
  cycle: "monthly" | "yearly";
  onSelect: (plan: PlanSlug) => void;
  loading?: boolean;
}

const PLAN_FEATURE_LABELS: Record<string, string> = {
  ai_enabled: "Conciliação com IA",
  relatorios_avancados: "Relatórios avançados",
  suporte_prioritario: "Suporte prioritário",
  api_access: "Acesso via API",
};

const ANNUAL_DISCOUNT = 0.2;

export function PlanCard({ plan, currentPlan, cycle, onSelect, loading }: PlanCardProps) {
  const isCurrent = currentPlan === plan.slug;
  const isPopular = plan.slug === "pro";
  const isEnterprise = plan.slug === "enterprise";

  const displayPrice =
    cycle === "yearly"
      ? Math.round(plan.priceBrl * (1 - ANNUAL_DISCOUNT))
      : plan.priceBrl;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all",
        isPopular && "border-primary shadow-md ring-2 ring-primary",
        isCurrent && "border-green-500 bg-green-50/40 dark:bg-green-950/20"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold">
            Mais popular
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold">{plan.name}</h3>
          {isCurrent && <Badge variant="outline" className="border-green-500 text-green-700 text-xs">Atual</Badge>}
        </div>

        {isEnterprise ? (
          <p className="text-3xl font-bold">Sob consulta</p>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">R$ {displayPrice}</span>
            <span className="text-muted-foreground text-sm">/mês</span>
          </div>
        )}

        {cycle === "yearly" && !isEnterprise && plan.priceBrl > 0 && (
          <p className="text-xs text-green-600 mt-1 font-medium">20% desconto no plano anual</p>
        )}

        {plan.trialDays > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{plan.trialDays} dias grátis</p>
        )}
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        <li className="flex items-start gap-2 text-sm">
          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          <span>
            {plan.features.max_empresas >= 999
              ? "Empresas ilimitadas"
              : `Até ${plan.features.max_empresas} empresa${plan.features.max_empresas !== 1 ? "s" : ""}`}
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          <span>
            {plan.features.max_transacoes_mes >= 999999
              ? "Transações ilimitadas"
              : `${plan.features.max_transacoes_mes.toLocaleString("pt-BR")} transações/mês`}
          </span>
        </li>
        {Object.entries(PLAN_FEATURE_LABELS).map(([key, label]) => {
          const enabled = plan.features[key as keyof typeof plan.features];
          if (!enabled) return null;
          return (
            <li key={key} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>{label}</span>
            </li>
          );
        })}
        {plan.features.mcps_ativos.map((mcp) => (
          <li key={mcp} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>Integração {mcp}</span>
          </li>
        ))}
      </ul>

      <Button
        className="w-full"
        variant={isPopular ? "default" : isCurrent ? "outline" : "outline"}
        disabled={isCurrent || loading}
        onClick={() => onSelect(plan.slug as PlanSlug)}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {isCurrent ? "Plano atual" : isEnterprise ? "Falar com vendas" : "Selecionar plano"}
      </Button>
    </div>
  );
}
