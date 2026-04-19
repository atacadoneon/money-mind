export const queryKeys = {
  contasPagar: {
    all: ["contas-pagar"] as const,
    list: (filters: Record<string, unknown>) => ["contas-pagar", "list", filters] as const,
    detail: (id: string) => ["contas-pagar", "detail", id] as const,
    summary: (filters: Record<string, unknown>) => ["contas-pagar", "summary", filters] as const
  },
  contasReceber: {
    all: ["contas-receber"] as const,
    list: (filters: Record<string, unknown>) => ["contas-receber", "list", filters] as const,
    detail: (id: string) => ["contas-receber", "detail", id] as const,
    summary: (filters: Record<string, unknown>) => ["contas-receber", "summary", filters] as const
  },
  contatos: {
    all: ["contatos"] as const,
    list: (filters: Record<string, unknown>) => ["contatos", "list", filters] as const,
    detail: (id: string) => ["contatos", "detail", id] as const
  },
  categorias: {
    all: ["categorias"] as const
  },
  formasPagamento: {
    all: ["formas-pagamento"] as const
  },
  extratos: {
    all: ["extratos"] as const,
    list: (filters: Record<string, unknown>) => ["extratos", "list", filters] as const,
    detail: (id: string) => ["extratos", "detail", id] as const
  },
  dashboard: {
    all: ["dashboard"] as const,
    kpis: (orgId: string) => ["dashboard", "kpis", orgId] as const,
    fluxoCaixa: (orgId: string) => ["dashboard", "fluxo-caixa", orgId] as const
  },
  empresas: {
    all: ["empresas"] as const,
    detail: (id: string) => ["empresas", "detail", id] as const
  },
  caixa: {
    all: ["caixa"] as const,
    saldo: ["caixa", "saldo"] as const,
    list: (filters: Record<string, unknown>) => ["caixa", "list", filters] as const
  },
  contaDigital: {
    all: ["conta-digital"] as const,
    contas: ["conta-digital", "contas"] as const,
    transacoes: (contaId: string) => ["conta-digital", "transacoes", contaId] as const
  },
  relatorios: {
    all: ["relatorios"] as const,
    dre: (params: Record<string, unknown>) => ["relatorios", "dre", params] as const,
    fluxoCaixa: (params: Record<string, unknown>) => ["relatorios", "fluxo-caixa", params] as const,
    contasPorCategoria: (params: Record<string, unknown>) =>
      ["relatorios", "contas-por-categoria", params] as const,
    topContatos: (params: Record<string, unknown>) =>
      ["relatorios", "top-contatos", params] as const
  },
  reconciliation: {
    all: ["reconciliation"] as const,
    suggestions: (extratoId: string) => ["reconciliation", "suggestions", extratoId] as const
  },
  configuracoes: {
    all: ["configuracoes"] as const,
    integracoes: ["configuracoes", "integracoes"] as const,
    membros: ["configuracoes", "membros"] as const,
    preferences: ["configuracoes", "preferences"] as const
  }
};
