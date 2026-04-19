import { api } from "@/lib/api/client";

export interface DashboardKpis {
  totalAPagar: number;
  totalAReceber: number;
  contasAtrasadasPagar: number;
  contasAtrasadasReceber: number;
  saldoConsolidado: number;
  porEmpresa: { empresaId: string; empresaNome: string; saldo: number }[];
}

export interface FluxoCaixaPonto {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface CategoriaTop {
  categoriaId: string;
  categoriaNome: string;
  total: number;
  participacao: number;
}

const EMPTY_KPIS: DashboardKpis = {
  totalAPagar: 0,
  totalAReceber: 0,
  contasAtrasadasPagar: 0,
  contasAtrasadasReceber: 0,
  saldoConsolidado: 0,
  porEmpresa: [],
};

export async function fetchDashboardKpis(empresaId?: string): Promise<DashboardKpis> {
  try {
    const { data } = await api.get<DashboardKpis>("/dashboard/kpis", { params: { empresaId } });
    return data;
  } catch {
    return EMPTY_KPIS;
  }
}

export async function fetchFluxoCaixa(dias = 30): Promise<FluxoCaixaPonto[]> {
  try {
    const { data } = await api.get<FluxoCaixaPonto[]>("/dashboard/fluxo-caixa", { params: { dias } });
    return data;
  } catch {
    return [];
  }
}

export async function fetchTopCategorias(tipo: "despesa" | "receita"): Promise<CategoriaTop[]> {
  try {
    const { data } = await api.get<CategoriaTop[]>("/dashboard/top-categorias", { params: { tipo } });
    return data;
  } catch {
    return [];
  }
}
