"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchReconciliationSuggestions,
  confirmMatch,
  ignoreMatch,
  runReconciliationJob,
  pollReconciliationStatus,
  type ConfirmMatchPayload
} from "@/lib/api/reconciliation.api";
import { extractApiError } from "@/lib/api/client";

export function useReconciliationSuggestions(extratoId: string | null) {
  return useQuery({
    queryKey: queryKeys.reconciliation.suggestions(extratoId ?? ""),
    queryFn: () => fetchReconciliationSuggestions(extratoId!),
    enabled: !!extratoId
  });
}

export function useConfirmMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConfirmMatchPayload) => confirmMatch(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.extratos.all });
      qc.invalidateQueries({ queryKey: queryKeys.reconciliation.all });
      toast.success("Conciliação confirmada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useIgnoreMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linhaId: string) => ignoreMatch(linhaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.extratos.all });
      qc.invalidateQueries({ queryKey: queryKeys.reconciliation.all });
      toast.success("Linha ignorada");
    },
    onError: (err) => toast.error(extractApiError(err).message)
  });
}

export function useRunReconciliationIA(extratoId: string | null) {
  const qc = useQueryClient();
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => clearPoll();
  }, []);

  const trigger = async () => {
    if (!extratoId) return;
    setRunning(true);
    try {
      const { jobId: jid } = await runReconciliationJob(extratoId);
      setJobId(jid);
      toast.info("Processando sugestões IA...");

      pollRef.current = setInterval(async () => {
        try {
          const res = await pollReconciliationStatus(jid);
          if (res.status === "done") {
            clearPoll();
            setRunning(false);
            qc.invalidateQueries({
              queryKey: queryKeys.reconciliation.suggestions(extratoId)
            });
            toast.success("Sugestões IA prontas");
          } else if (res.status === "error") {
            clearPoll();
            setRunning(false);
            toast.error("Erro ao gerar sugestões IA");
          }
        } catch {
          clearPoll();
          setRunning(false);
        }
      }, 2000);
    } catch (err) {
      setRunning(false);
      toast.error(extractApiError(err).message);
    }
  };

  return { trigger, running, jobId };
}
