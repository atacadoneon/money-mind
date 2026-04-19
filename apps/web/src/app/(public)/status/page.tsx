"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api/v1";

type ComponentStatus = "operational" | "degraded" | "outage" | "checking";

interface StatusComponent {
  name: string;
  key: string;
  status: ComponentStatus;
  lastChecked?: string;
}

const INITIAL_COMPONENTS: StatusComponent[] = [
  { name: "API (backend)", key: "api", status: "checking" },
  { name: "Web App", key: "web", status: "checking" },
  { name: "Banco de dados", key: "db", status: "checking" },
  { name: "Cache (Redis)", key: "redis", status: "checking" },
  { name: "Workers (filas)", key: "workers", status: "checking" },
];

function StatusIcon({ status }: { status: ComponentStatus }) {
  switch (status) {
    case "operational":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "degraded":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case "outage":
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
  }
}

const STATUS_LABELS: Record<ComponentStatus, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  outage: "Indisponível",
  checking: "Verificando...",
};

const STATUS_VARIANT: Record<ComponentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  operational: "default",
  degraded: "secondary",
  outage: "destructive",
  checking: "outline",
};

export default function StatusPage() {
  const [components, setComponents] = React.useState<StatusComponent[]>(INITIAL_COMPONENTS);
  const [lastUpdate, setLastUpdate] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);

  const checkStatus = React.useCallback(async () => {
    setIsChecking(true);
    const now = new Date().toLocaleTimeString("pt-BR");

    try {
      const res = await fetch(`${API_URL.replace("/api/v1", "")}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = res.ok ? await res.json().catch(() => ({})) : {};

      setComponents([
        { name: "API (backend)", key: "api", status: res.ok ? "operational" : "outage", lastChecked: now },
        { name: "Web App", key: "web", status: "operational", lastChecked: now },
        { name: "Banco de dados", key: "db", status: data?.database === "ok" ? "operational" : res.ok ? "degraded" : "outage", lastChecked: now },
        { name: "Cache (Redis)", key: "redis", status: data?.redis === "ok" ? "operational" : res.ok ? "degraded" : "outage", lastChecked: now },
        { name: "Workers (filas)", key: "workers", status: data?.workers === "ok" ? "operational" : res.ok ? "degraded" : "outage", lastChecked: now },
      ]);
    } catch {
      setComponents((prev) =>
        prev.map((c) => ({
          ...c,
          status: c.key === "web" ? "operational" : "outage",
          lastChecked: now,
        }))
      );
    }

    setLastUpdate(now);
    setIsChecking(false);
  }, []);

  React.useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30 * 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const allOperational = components.every((c) => c.status === "operational");
  const hasOutage = components.some((c) => c.status === "outage");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">
            Money<span className="text-primary">Mind</span> — Status
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            {allOperational ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span className="text-lg font-medium text-green-700 dark:text-green-400">
                  Todos os sistemas operacionais
                </span>
              </>
            ) : hasOutage ? (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                <span className="text-lg font-medium text-destructive">
                  Incidente em andamento
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-500" />
                <span className="text-lg font-medium text-yellow-700 dark:text-yellow-400">
                  Degradação parcial
                </span>
              </>
            )}
          </div>
        </div>

        {/* Components */}
        <div className="space-y-2 mb-8">
          {components.map((comp) => (
            <div
              key={comp.key}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={comp.status} />
                <span className="font-medium text-sm">{comp.name}</span>
              </div>
              <div className="flex items-center gap-3">
                {comp.lastChecked && (
                  <span className="text-xs text-muted-foreground">Verificado às {comp.lastChecked}</span>
                )}
                <Badge variant={STATUS_VARIANT[comp.status]} className="text-xs">
                  {STATUS_LABELS[comp.status]}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {lastUpdate ? `Última verificação: ${lastUpdate}` : "Verificando..."}
            {" — "}atualiza automaticamente a cada 30s
          </p>
          <Button size="sm" variant="outline" onClick={checkStatus} disabled={isChecking}>
            {isChecking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Verificar agora
          </Button>
        </div>

        {/* Incident history placeholder */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-4">Histórico de incidentes (90 dias)</h2>
          <div className="rounded-lg border bg-card p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum incidente registrado nos últimos 90 dias.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
