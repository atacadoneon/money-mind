"use client";

import { useDashboardKpis, useFluxoCaixa, useTopCategorias } from "@/hooks/use-dashboard";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "danger" | "success" | "warn";
}) {
  const toneCls = {
    default: "text-primary",
    danger: "text-destructive",
    success: "text-success",
    warn: "text-warning"
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InicioPage() {
  const selected = useAuthStore((s) => s.selectedCompany);
  const kpisQ = useDashboardKpis(selected?.id);
  const fluxoQ = useFluxoCaixa(30);
  const topDespQ = useTopCategorias("despesa");

  return (
    <>
      <PageHeader
        title="Início"
        description={`Visão consolidada — ${selected?.nome ?? "todas empresas"}`}
      />

      <div className="p-6 space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpisQ.isLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <Kpi
                label="Total a pagar"
                value={formatCurrency(kpisQ.data?.totalAPagar ?? 0)}
                hint={`${kpisQ.data?.contasAtrasadasPagar ?? 0} atrasadas`}
                icon={ArrowUpCircle}
                tone="danger"
              />
              <Kpi
                label="Total a receber"
                value={formatCurrency(kpisQ.data?.totalAReceber ?? 0)}
                hint={`${kpisQ.data?.contasAtrasadasReceber ?? 0} atrasadas`}
                icon={ArrowDownCircle}
                tone="success"
              />
              <Kpi
                label="Saldo consolidado"
                value={formatCurrency(kpisQ.data?.saldoConsolidado ?? 0)}
                icon={TrendingUp}
                tone={(kpisQ.data?.saldoConsolidado ?? 0) >= 0 ? "success" : "danger"}
              />
              <Kpi
                label="Contas atrasadas"
                value={String(
                  (kpisQ.data?.contasAtrasadasPagar ?? 0) + (kpisQ.data?.contasAtrasadasReceber ?? 0)
                )}
                icon={AlertCircle}
                tone="warn"
              />
            </>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Fluxo de caixa (próximos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {fluxoQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fluxoQ.data ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="data"
                      tickFormatter={(v) => formatDate(v, "dd/MM")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <ReTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(v) => formatDate(v)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="entradas"
                      name="Entradas"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="saidas"
                      name="Saídas"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 categorias (despesas)</CardTitle>
            </CardHeader>
            <CardContent>
              {topDespQ.isLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-6" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {(topDespQ.data ?? []).slice(0, 10).map((c) => (
                    <li key={c.categoriaId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{c.categoriaNome}</span>
                        <span className="font-medium">{formatCurrency(c.total)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(c.participacao, 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Saldo por empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {kpisQ.isLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                  {(kpisQ.data?.porEmpresa ?? []).map((e) => (
                    <div key={e.empresaId} className="rounded-lg border p-4">
                      <p className="text-xs text-muted-foreground">{e.empresaNome}</p>
                      <p
                        className={`text-lg font-semibold ${
                          e.saldo >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {formatCurrency(e.saldo)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
