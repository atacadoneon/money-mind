import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface TinyV3ContaPagar {
  id?: number;
  dataVencimento?: string; // YYYY-MM-DD
  historico?: string;
  valor?: number;
  situacao?: string;
  contato?: { id?: number };
  categoriaReceitaDespesa?: { id?: number };
  marcadores?: Array<{ descricao: string }>;
}

/**
 * Cliente para Tiny ERP API V3 (erp.tiny.com.br/public-api/v3/)
 *
 * Limitações documentadas em PROCESSOS_FINANCEIRO.md:
 * - V3 NÃO salva categoria (bug conhecido) — usar V2 para criar CP com categoria
 * - V3 aceita marcadores na criação
 * - V3 paginação tem bug: retorna mesmos 100 registros em loop
 * - V3 usa OAuth2 Bearer token
 */
@Injectable()
export class TinyV3Client {
  private readonly logger = new Logger('TinyV3Client');
  private readonly BASE_HOST = 'erp.tiny.com.br';
  private readonly BASE_PATH = '/public-api/v3';
  private tokenCache = new Map<string, TokenCache>();

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    apiPath: string,
    token: string,
    body?: unknown,
    retries = 3,
  ): Promise<{ status: number; data: T }> {
    const postData = body ? JSON.stringify(body) : null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await new Promise<{ status: number; data: T }>((resolve, reject) => {
          const opts: https.RequestOptions = {
            hostname: this.BASE_HOST,
            path: `${this.BASE_PATH}${apiPath}`,
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
              ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
            },
          };

          const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', (c: string) => (data += c));
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode ?? 0, data: JSON.parse(data) as T });
              } catch {
                resolve({ status: res.statusCode ?? 0, data: data as unknown as T });
              }
            });
          });
          req.on('error', reject);
          if (postData) req.write(postData);
          req.end();
        });
        return result;
      } catch (err) {
        this.logger.warn(`[V3] ${method} ${apiPath} tentativa ${attempt}/${retries}: ${(err as Error).message}`);
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Tiny V3 request failed after retries');
  }

  // ─── Contas a Pagar V3 ───────────────────────────────────────────────────────

  /**
   * Cria CP via V3 com marcadores.
   * IMPORTANTE: categoria NÃO funciona via V3 (bug Tiny) — use V2 para isso.
   * Usar V3 apenas quando precisar de marcadores na criação.
   */
  async criarCP(
    token: string,
    cp: TinyV3ContaPagar,
  ): Promise<{ status: number; data: unknown }> {
    return this.request('POST', '/contas-pagar', token, cp);
  }

  async adicionarMarcadorCP(
    token: string,
    id: number,
    marcador: string,
  ): Promise<{ status: number; data: unknown }> {
    return this.request('PUT', `/contas-pagar/${id}`, token, {
      marcadores: [{ descricao: marcador }],
    });
  }

  // ─── Contas a Receber V3 ─────────────────────────────────────────────────────

  /**
   * Lista CR — ATENÇÃO: paginação V3 tem bug, não usar para grandes volumes.
   * Para >100 registros use TinyV2Client.listarCR() com paginação por páginas.
   */
  async listarCR(
    token: string,
    opts: { situacao?: string; limit?: number } = {},
  ): Promise<unknown[]> {
    const qs = new URLSearchParams({
      limit: String(opts.limit ?? 100),
      ...(opts.situacao ? { situacao: opts.situacao } : {}),
    });
    const res = await this.request<{ itens?: unknown[] }>('GET', `/contas-receber?${qs}`, token);
    return res.data?.itens ?? [];
  }

  async adicionarMarcadorCR(
    token: string,
    id: number,
    marcador: string,
  ): Promise<{ status: number; data: unknown }> {
    return this.request('PUT', `/contas-receber/${id}`, token, {
      marcadores: [{ descricao: marcador }],
    });
  }
}
