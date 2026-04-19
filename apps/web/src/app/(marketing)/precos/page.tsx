"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLANS = [
  {
    slug: "starter",
    name: "Starter",
    price: 49,
    description: "Para pequenas empresas e autônomos",
    features: [
      "Até 3 empresas",
      "5.000 transações/mês",
      "Integração Tiny ERP",
      "Conciliação manual assistida",
      "Relatórios básicos",
      "Suporte via e-mail",
      "Trial 14 dias grátis",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: 149,
    description: "Para contadores e BPOs em crescimento",
    popular: true,
    features: [
      "Até 10 empresas",
      "30.000 transações/mês",
      "Integração Tiny + Bancos",
      "Conciliação automática com IA",
      "Relatórios avançados (DRE, FC)",
      "Régua de cobrança",
      "Suporte via e-mail + chat",
      "Trial 14 dias grátis",
    ],
  },
  {
    slug: "business",
    name: "Business",
    price: 449,
    description: "Para BPOs e contabilidades maiores",
    features: [
      "Empresas ilimitadas",
      "Transações ilimitadas",
      "Todas as integrações",
      "IA avançada + sugestões",
      "API access",
      "Relatórios personalizados",
      "Suporte prioritário",
      "SLA 99,9%",
      "Trial 14 dias grátis",
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: null,
    description: "Para grandes operações e grupos empresariais",
    features: [
      "Tudo do Business",
      "Gerente de conta dedicado",
      "Instância dedicada (opcional)",
      "Customizações sob medida",
      "Integração via API personalizada",
      "SLA 99,95% + créditos",
      "Suporte 24/7",
      "Contrato negociável",
      "Trial 30 dias",
    ],
  },
];

const ANNUAL_DISCOUNT = 0.2;

export default function PrecosPage() {
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly");

  return (
    <div className="py-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Planos e Preços</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Escolha o plano ideal para sua operação. Todos com trial de 14 dias grátis.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1">
            <button
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCycle("monthly")}
            >
              Mensal
            </button>
            <button
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${cycle === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCycle("yearly")}
            >
              Anual
              <span className="ml-1.5 text-xs text-green-600 font-semibold">-20%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => {
            const displayPrice = plan.price !== null
              ? cycle === "yearly"
                ? Math.round(plan.price * (1 - ANNUAL_DISCOUNT))
                : plan.price
              : null;

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-xl border bg-card p-6 ${plan.popular ? "border-primary ring-2 ring-primary shadow-lg" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">Mais popular</Badge>
                  </div>
                )}

                <div className="mb-5">
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                  <div className="mt-3">
                    {displayPrice !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">R$ {displayPrice}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold">Sob consulta</p>
                    )}
                    {cycle === "yearly" && displayPrice !== null && plan.price !== null && (
                      <p className="text-xs text-green-600 mt-1">
                        R$ {Math.round(plan.price * (1 - ANNUAL_DISCOUNT) * 12)} cobrado anualmente
                      </p>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className="w-full"
                  asChild
                >
                  <Link href={plan.slug === "enterprise" ? "/contato" : `/register?plan=${plan.slug}&cycle=${cycle}`}>
                    {plan.slug === "enterprise" ? "Falar com vendas" : "Começar grátis"}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          Todos os planos incluem: SSL, backups diários, conformidade LGPD, suporte a múltiplos usuários.
          <br />
          Preços em BRL. Pagamento via Stripe (cartão ou boleto). Cancele a qualquer momento.
        </p>

        {/* Compare features table */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Comparativo completo</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold">Funcionalidade</th>
                  <th className="text-center px-4 py-3">Starter</th>
                  <th className="text-center px-4 py-3 bg-primary/5">Pro</th>
                  <th className="text-center px-4 py-3">Business</th>
                  <th className="text-center px-4 py-3">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Empresas", "3", "10", "Ilimitadas", "Ilimitadas"],
                  ["Transações/mês", "5.000", "30.000", "Ilimitadas", "Ilimitadas"],
                  ["Integração Tiny ERP", "✓", "✓", "✓", "✓"],
                  ["Integração Bancos", "—", "✓", "✓", "✓"],
                  ["Conciliação com IA", "—", "✓", "✓", "✓"],
                  ["Relatórios avançados", "—", "✓", "✓", "✓"],
                  ["Régua de cobrança", "—", "✓", "✓", "✓"],
                  ["API access", "—", "—", "✓", "✓"],
                  ["Suporte prioritário", "—", "—", "✓", "✓"],
                  ["SLA garantido", "—", "—", "99,9%", "99,95%"],
                  ["Gerente dedicado", "—", "—", "—", "✓"],
                ].map(([feature, ...values]) => (
                  <tr key={feature} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{feature}</td>
                    {values.map((v, i) => (
                      <td key={i} className={`text-center px-4 py-3 ${i === 1 ? "bg-primary/5" : ""} ${v === "—" ? "text-muted-foreground" : v === "✓" ? "text-green-600" : ""}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
