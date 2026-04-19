"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchRelatorioDRE,
  fetchRelatorioFluxoCaixa,
  fetchRelatorioContasPorCategoria,
  fetchRelatorioTopContatos
} from "@/lib/api/relatorios.api";

export function useRelatorioDRE(params: {
  empresaId?: string;
  inicio: string;
  fim: string;
}) {
  return useQuery({
    queryKey: queryKeys.relatorios.dre(params as Record<string, unknown>),
    queryFn: () => fetchRelatorioDRE(params),
    enabled: !!params.inicio && !!params.fim
  });
}

export function useRelatorioFluxoCaixa(params: {
  dias: 30 | 60 | 90;
  empresaId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.relatorios.fluxoCaixa(params as Record<string, unknown>),
    queryFn: () => fetchRelatorioFluxoCaixa(params)
  });
}

export function useRelatorioContasPorCategoria(params: {
  tipo: "despesa" | "receita";
  inicio: string;
  fim: string;
  empresaId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.relatorios.contasPorCategoria(params as Record<string, unknown>),
    queryFn: () => fetchRelatorioContasPorCategoria(params),
    enabled: !!params.inicio && !!params.fim
  });
}

export function useRelatorioTopContatos(params: {
  tipo: "fornecedor" | "cliente";
  inicio: string;
  fim: string;
  empresaId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.relatorios.topContatos(params as Record<string, unknown>),
    queryFn: () => fetchRelatorioTopContatos(params),
    enabled: !!params.inicio && !!params.fim
  });
}
