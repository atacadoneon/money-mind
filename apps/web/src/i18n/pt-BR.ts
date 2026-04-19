export const ptBR = {
  nav: {
    inicio: "Início",
    cadastros: "Cadastros",
    financas: "Finanças",
    configuracoes: "Configurações",
    contasPagar: "Contas a Pagar",
    contasReceber: "Contas a Receber",
    conciliacao: "Conciliação",
    caixa: "Caixa",
    contaDigital: "Conta Digital",
    extratos: "Extratos Bancários",
    relatorios: "Relatórios",
    cobrancas: "Cobranças Bancárias",
    transacoesVendas: "Transações de Vendas",
    clientesFornecedores: "Clientes / Fornecedores",
    categorias: "Categorias",
    formasPagamento: "Formas de Pagamento"
  },
  common: {
    salvar: "Salvar",
    cancelar: "Cancelar",
    excluir: "Excluir",
    editar: "Editar",
    novo: "Novo",
    nova: "Nova",
    buscar: "Buscar",
    filtrar: "Filtrar",
    exportar: "Exportar",
    importar: "Importar",
    confirmar: "Confirmar",
    voltar: "Voltar",
    continuar: "Continuar",
    pular: "Pular",
    fechar: "Fechar",
    sim: "Sim",
    nao: "Não",
    carregando: "Carregando...",
    salvando: "Salvando...",
    erro: "Erro",
    sucesso: "Sucesso",
    atencao: "Atenção",
    semDados: "Nenhum dado encontrado",
    todos: "Todos",
    todas: "Todas",
    ativo: "Ativo",
    inativo: "Inativo",
    pendente: "Pendente",
    obrigatorio: "Obrigatório"
  },
  dashboard: {
    titulo: "Início",
    descricao: "Visão consolidada",
    totalPagar: "Total a pagar",
    totalReceber: "Total a receber",
    saldoConsolidado: "Saldo consolidado",
    contasAtrasadas: "Contas atrasadas",
    fluxoCaixa: "Fluxo de caixa",
    topCategorias: "Top categorias",
    porEmpresa: "Saldo por empresa"
  },
  contasPagar: {
    titulo: "Contas a Pagar",
    nova: "Nova conta a pagar",
    status: {
      em_aberto: "Em aberto",
      emitida: "Emitida",
      paga: "Paga",
      atrasada: "Atrasada",
      cancelada: "Cancelada"
    }
  },
  contasReceber: {
    titulo: "Contas a Receber",
    nova: "Nova conta a receber",
    status: {
      em_aberto: "Em aberto",
      emitida: "Emitida",
      recebida: "Recebida",
      atrasada: "Atrasada",
      cancelada: "Cancelada"
    }
  },
  conciliacao: {
    titulo: "Conciliação bancária",
    gerarSugestoes: "Gerar sugestões IA",
    gerando: "Gerando...",
    confirmar: "Confirmar conciliação",
    ignorar: "Ignorar"
  },
  onboarding: {
    bemVindo: "Bem-vindo ao Money Mind",
    configurar: "Vamos configurar em 5 min",
    etapa: "Etapa",
    de: "de"
  }
} as const;

type DeepRecord<T> = {
  [K in keyof T]: T[K] extends object ? DeepRecord<T[K]> : string;
};
export type Messages = DeepRecord<typeof ptBR>;
