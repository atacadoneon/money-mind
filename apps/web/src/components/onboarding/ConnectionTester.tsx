"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Wifi } from "lucide-react";
import { api } from "@/lib/api/client";

type Status = "idle" | "loading" | "success" | "error";

interface Props {
  companyId?: string;
  type: "tiny" | "conta-simples";
  onSuccess?: () => void;
}

export function ConnectionTester({ companyId, type, onSuccess }: Props) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState("");

  const test = async () => {
    if (!companyId) return;
    setStatus("loading");
    setMessage("");
    try {
      const endpoint =
        type === "tiny"
          ? `/mcps/tiny/test-connection/${companyId}`
          : `/conta-simples/test-connection/${companyId}`;
      const { data } = await api.post<{ ok: boolean; message?: string }>(endpoint);
      if (data.ok) {
        setStatus("success");
        setMessage(data.message ?? "Conexão estabelecida com sucesso");
        onSuccess?.();
      } else {
        setStatus("error");
        setMessage(data.message ?? "Falha na conexão");
      }
    } catch (err: unknown) {
      setStatus("error");
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setMessage(
        axiosErr?.response?.data?.message ?? axiosErr?.message ?? "Erro ao testar conexão"
      );
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={test}
        disabled={status === "loading" || !companyId}
      >
        {status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wifi className="h-4 w-4" />
        )}
        Testar conexão
      </Button>

      {status === "success" && (
        <div className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          {message}
        </div>
      )}
    </div>
  );
}
