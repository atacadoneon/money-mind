import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as querystring from 'querystring';

export interface TinyV2Response<T = unknown> {
  retorno: {
    status: 'OK' | 'Erro';
    status_processamento?: number;
    registros?: Array<{ registro: T }>;
    registro?: T;
    contatos?: Array<{ contato: T }>;
    contas?: Array<{ conta: T }>;
    erros?: Array<{ erro: string }>;
    numero_paginas?: number;
    pagina?: number;
  };
}

export interface TinyContaPagar {
  id?: string;
  situacao?: string;
  data_vencimento?: string;
  valor?: number;
  saldo?: number;
  historico?: string;
  nome_cliente?: string;
  categoria?: { nome?: string };
  contato?: { nome?: string };
  data_pagamento?: string;
  data_emissao?: string;
  valor_pago?: number;
  conta_origem?: string;
}

export interface TinyContaReceber {
  id?: string;
  situacao?: string;
  data_vencimento?: string;
  valor?: number;
  saldo?: number;
  historico?: string;
  nome_cliente?: string;
  categoria?: { nome?: string };
  contato?: { nome?: string };
  data_recebimento?: string;
  data_emissao?: string;
  valor_recebido?: number;
}

export interface TinyContato {
  id?: string;
  nome?: string;
  tipo_pessoa?: 'F' | 'J';
  cpf_cnpj?: string;
  email?: string;
}

export interface TinyBaixarCP {
  id: string;
  data: string; // DD/MM/YYYY
  valorPago: number;
  contaOrigem: string; // OBRIGATÓRIO — nunca Caixa genérico
  obs?: string;
}

export interface TinyBaixarCR {
  id: string;
  data: string; // DD/MM/YYYY
  valorPago: number;
  obs?: string;
}

/**
 * Cliente para Tiny ERP API V2 (api.tiny.com.br/api2/)
 *
 * Regras documentadas em PROCESSOS_FINANCEIRO.md:
 * - V2 é mais confiável para listagens grandes (V3 tem bug de paginação)
 * - V2 suporta categoria pelo NOME
 * - V2 não suporta marcadores (usar V3 para isso)
 * - Autenticação por token (query param ou form field)
 * - Rate limit: 10 req/s — este client aplica throttle automático
 */
@Injectable()
export class TinyV2Client {
  private readonly logger = new Logger('TinyV2Client');
  private readonly BASE_HOST = 'api.tiny.com.br';
  private readonly BASE_PATH = '/api2';

  /** Fila simples de rate limiting (10 req/s = 100ms entre requests) */
  private lastRequestAt = 0;
  private readonly MIN_INTERVAL_MS = 110; // 100ms + margem

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, this.MIN_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  private async request<T>(
    endpoint: string,
    token: string,
    params: Record<string, unknown> = {},
    retries = 3,
  ): Promise<TinyV2Response<T>> {
    await this.throttle();

    const postData = querystring.stringify({
      token,
      formato: 'JSON',
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]),
      ),
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await new Promise<TinyV2Response<T>>((resolve, reject) => {
          const req = https.request(
            {
              hostname: this.BASE_HOST,
              path: `${this.BASE_PATH}/${endpoint}`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
              },
            },
            (res) => {
              let data = '';
              res.on('data', (chunk: string) => (data += chunk));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(data) as TinyV2Response<T>);
                } catch {
                  reject(new Error(`Tiny V2 parse error: ${data.slice(0, 200)}`));
                }
              });
            },
          );
          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        const status = result.retorno?.status;
        if (status === 'Erro') {
          const erros = result.retorno?.erros?.map((e) => e.erro).join(', ') ?? 'Erro desconhecido';
          this.logger.warn(`[V2] ${endpoint} retornou Erro: ${erros}`);
        }
        return result;
      } catch (err) {
        this.logger.warn(`[V2] ${endpoint} tentativa ${attempt}/${retries}: ${(err as Error).message}`);
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Tiny V2 request failed after retries');
  }

  // ─── Contas a Pagar ──────────────────────────────────────────────────────────

  async listarCP(
    token: string,
    opts: { situacao?: string; dataInicial?: string; dataFinal?: string; pagina?: number } = {},
  ): Promise<TinyContaPagar[]> {
    const params: Record<string, unknown> = { pagina: opts.pagina ?? 1 };
    if (opts.situacao) params.situacao = opts.situacao;
    if (opts.dataInicial) params.dataInicial = opts.dataInicial;
    if (opts.dataFinal) params.dataFinal = opts.dataFinal;
    if (!params.situacao && !params.dataInicial && !params.dataFinal) {
      params.situacao = 'aberto';
    }

    const res = await this.request<TinyContaPagar>('contas.pagar.pesquisa.php', token, params);
    const contas = (res.retorno as Record<string, unknown>)?.contas as Array<{ conta: TinyContaPagar }> | undefined;
    if (contas) return contas.map((c) => c.conta);
    return (res.retorno?.registros ?? []).map((r) => (r as Record<string, unknown>)?.registro ?? r) as TinyContaPagar[];
  }

  async criarCP(
    token: string,
    cp: {
      cliente: { nome: string; tipo_pessoa?: 'F' | 'J' };
      vencimento: string; // DD/MM/YYYY
      valor: number;
      historico: string;
      categoria?: string; // nome da categoria
      situacao?: string;
    },
  ): Promise<TinyV2Response> {
    return this.request('conta.pagar.incluir.php', token, {
      conta: {
        cliente: cp.cliente,
        vencimento: cp.vencimento,
        valor: cp.valor,
        historico: cp.historico,
        categoria: cp.categoria ?? '',
        situacao: cp.situacao ?? 'aberto',
      },
    });
  }

  /**
   * Baixar conta a pagar.
   * CRÍTICO: contaOrigem é obrigatório — nunca usar "Caixa" genérico.
   */
  async baixarCP(token: string, dados: TinyBaixarCP): Promise<TinyV2Response> {
    if (!dados.contaOrigem || dados.contaOrigem.trim() === '') {
      throw new Error('contaOrigem é obrigatório para baixar conta a pagar no Tiny');
    }
    return this.request('conta.pagar.baixar.php', token, {
      conta: {
        id: dados.id,
        data: dados.data,
        valorPago: dados.valorPago,
        contaOrigem: dados.contaOrigem,
        obs: dados.obs ?? '',
      },
    });
  }

  // ─── Contas a Receber ────────────────────────────────────────────────────────

  async listarCR(
    token: string,
    opts: { situacao?: string; dataInicial?: string; dataFinal?: string; pagina?: number } = {},
  ): Promise<TinyContaReceber[]> {
    const params: Record<string, unknown> = { pagina: opts.pagina ?? 1 };
    if (opts.situacao) params.situacao = opts.situacao;
    if (opts.dataInicial) params.dataInicial = opts.dataInicial;
    if (opts.dataFinal) params.dataFinal = opts.dataFinal;
    if (!params.situacao && !params.dataInicial && !params.dataFinal) {
      params.situacao = 'aberto';
    }

    const res = await this.request<TinyContaReceber>('contas.receber.pesquisa.php', token, params);
    const contas = (res.retorno as Record<string, unknown>)?.contas as Array<{ conta: TinyContaReceber }> | undefined;
    if (contas) return contas.map((c) => c.conta);
    return (res.retorno?.registros ?? []).map((r) => (r as Record<string, unknown>)?.registro ?? r) as TinyContaReceber[];
  }

  async baixarCR(token: string, dados: TinyBaixarCR): Promise<TinyV2Response> {
    return this.request('conta.receber.baixar.php', token, {
      conta: {
        id: dados.id,
        data: dados.data,
        valorPago: dados.valorPago,
        obs: dados.obs ?? '',
      },
    });
  }

  async adicionarMarcadorCR(token: string, id: string, marcador: string): Promise<TinyV2Response> {
    return this.request('conta.receber.alterar.php', token, {
      conta: {
        id,
        marcadores: [{ marcador: { descricao: marcador } }],
      },
    });
  }

  // ─── Contatos ────────────────────────────────────────────────────────────────

  async listarContatos(
    token: string,
    opts: { nome?: string; cpfCnpj?: string; pagina?: number } = {},
  ): Promise<TinyContato[]> {
    const res = await this.request<TinyContato>('contatos.pesquisa.php', token, {
      nome: opts.nome ?? '',
      cpf_cnpj: opts.cpfCnpj ?? '',
      pagina: opts.pagina ?? 1,
    });
    const contatos = (res.retorno as Record<string, unknown>)?.contatos as Array<{ contato: TinyContato }> | undefined;
    if (contatos) return contatos.map((c) => c.contato);
    return (res.retorno?.registros ?? []).map((r) => (r as Record<string, unknown>)?.registro ?? r) as TinyContato[];
  }

  async criarContato(
    token: string,
    contato: { nome: string; tipo_pessoa?: 'F' | 'J'; cpf_cnpj?: string; email?: string },
  ): Promise<TinyV2Response> {
    return this.request('contato.incluir.php', token, {
      contato: {
        nome: contato.nome,
        tipo_pessoa: contato.tipo_pessoa ?? 'J',
        cpf_cnpj: contato.cpf_cnpj ?? '',
        email: contato.email ?? '',
      },
    });
  }

  /** Formata data de YYYY-MM-DD para DD/MM/YYYY (formato Tiny V2) */
  static formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
