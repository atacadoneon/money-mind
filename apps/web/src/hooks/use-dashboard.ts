"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchDashboardKpis,
  fetchFluxoCaixa,
  fetchTopCategorias
} from "@/lib/api/dashboard.api";

export function useDashboardKpis(empresaId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis(empresaId ?? "all"),
    queryFn: () => fetchDashboardKpis(empresaId)
  });
}

export function useFluxoCaixa(dias = 30) {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, "fluxo", dias],
    queryFn: () => fetchFluxoCaixa(dias)
  });
}

export function useTopCategorias(tipo: "despesa" | "receita") {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, "top-cat", tipo],
    queryFn: () => fetchTopCategorias(tipo)
  });
}
