"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UsageMeter } from "@/components/billing/UsageMeter";
import { InvoicesTable } from "@/components/billing/InvoicesTable";
import {
  useSubscription,
  useCreatePortal,
  useCancelSubscription,
  useTrialDaysLeft,
} from "@/hooks/use-billing";

const STATUS_CONFIG = {
  trialing: { label: "Em trial", variant: "secondary" as const, icon: Clock },
  active: { label: "Ativo", variant: "default" as const, icon: CheckCircle },
  past_due: { label: "Pagamento em atraso", variant: "destructive" as const, icon: AlertTriangle },
  canceled: { label: "Cancelado", variant: "outline" as const, icon: XCircle },
  unpaid: { label: "Inadimplente", variant: "destructive" as const, icon: AlertTriangle },
  incomplete: { label: "Incompleto", variant: "secondary" as const, icon: Clock },
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export default function BillingPage() {
  const { data: sub, isLoading } = useSubscription();
  const portal = useCreatePortal();
  const cancel = useCancelSubscription();
  const daysLeft = useTrialDaysLeft();
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);

  const statusConfig = sub ? (STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active) : null;

  return (
    <>
      <PageHeader
        title="Billing & Assinatura"
        description="Gerencie seu plano, faturas e uso da plataforma"
      />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plano atual
            </CardTitle>
            <CardDescription>Informações da sua assinatura</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-9 w-40" />
              </div>
            ) : sub ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl font-bold">
                    {PLAN_LABELS[sub.plan] ?? sub.plan}
                  </span>
                  {statusConfig && (
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      <statusConfig.icon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  )}
                  {sub.cancelAtPeriodEnd && (
                    <Badge variant="outline" className="border-orange-400 text-orange-600">
                      Cancela ao final do período
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {sub.planDetails && sub.planDetails.priceBrl > 0 && (
                    <div>
                      <p className="text-muted-foreground">Valor</p>
                      <p className="font-medium">
                        R$ {sub.planDetails.priceBrl}/mês
                      </p>
                    </div>
                  )}

                  {sub.status === "trialing" && sub.trialEnd && (
                    <div>
                      <p className="text-muted-foreground">Trial expira em</p>
                      <p className="font-medium">
                        {format(new Date(sub.trialEnd), "dd/MM/yyyy", { locale: ptBR })}
                        <span className="text-muted-foreground ml-1 text-xs">({daysLeft} dias)</span>
                      </p>
                    </div>
                  )}

                  {sub.currentPeriodEnd && sub.status === "active" && (
                    <div>
                      <p className="text-muted-foreground">Próxima cobrança</p>
                      <p className="font-medium">
                        {format(new Date(sub.currentPeriodEnd), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {sub.hasStripeSubscription && (
                    <Button
                      variant="outline"
                      onClick={() => portal.mutate()}
                      disabled={portal.isPending}
                    >
                      {portal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Gerenciar assinatura
                    </Button>
                  )}

                  <Button variant="outline" asChild>
                    <Link href="/planos">Ver planos disponíveis</Link>
                  </Button>

                  {sub.status === "trialing" && (
                    <Button asChild>
                      <Link href="/planos">Escolher plano agora</Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Trial Banner */}
        {sub?.status === "trialing" && daysLeft > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-primary">
                    {daysLeft <= 3
                      ? `Apenas ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} de trial restante${daysLeft !== 1 ? "s" : ""}!`
                      : `${daysLeft} dias de trial restantes`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Escolha um plano para continuar usando o Money Mind BPO sem interrupções.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/planos">Escolher plano</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage */}
        {sub?.planDetails && (
          <Card>
            <CardHeader>
              <CardTitle>Uso atual</CardTitle>
              <CardDescription>Consumo do seu plano {PLAN_LABELS[sub.plan]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageMeter
                label="Empresas ativas"
                used={0}
                limit={sub.planDetails.features.max_empresas}
              />
              <UsageMeter
                label="Transações este mês"
                used={0}
                limit={sub.planDetails.features.max_transacoes_mes}
              />
            </CardContent>
          </Card>
        )}

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de faturas</CardTitle>
            <CardDescription>Suas últimas cobranças</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <InvoicesTable invoices={sub?.invoices ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Cancel */}
        {sub && sub.status === "active" && !sub.cancelAtPeriodEnd && (
          <div className="flex justify-end">
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive text-sm">
                  Cancelar assinatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar assinatura?</DialogTitle>
                  <DialogDescription>
                    Sua assinatura continuará ativa até o final do período atual. Após isso, sua conta
                    será rebaixada para o plano Free e algumas funcionalidades serão desativadas.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                    Manter assinatura
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={cancel.isPending}
                    onClick={() => {
                      cancel.mutate();
                      setCancelDialogOpen(false);
                    }}
                  >
                    {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar cancelamento
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </>
  );
}
