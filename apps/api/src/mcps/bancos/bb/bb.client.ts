import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Banco do Brasil Open Banking client — stub funcional.
 * Base: https://api.hm.bb.com.br (homologação)
 */
@Injectable()
export class BbClient {
  private readonly logger = new Logger(BbClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('BB_BASE_URL', 'https://api.hm.bb.com.br');
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret) return 'stub-token';

    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
    });
    if (!res.ok) return 'stub-token';
    const d = await res.json() as { access_token: string };
    return d.access_token;
  }

  async getSaldo(credentials: Record<string, string>, conta: string) {
    const token = await this.getToken(credentials);
    if (token === 'stub-token') return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };

    const res = await fetch(`${this.baseUrl}/contas/${conta}/saldo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`BB saldo error: ${res.status}`);
    return res.json();
  }

  async getExtrato(credentials: Record<string, string>, conta: string, from: string, to: string): Promise<unknown[]> {
    const token = await this.getToken(credentials);
    if (token === 'stub-token') {
      this.logger.warn('BB extrato returning stub');
      return [];
    }

    const res = await fetch(
      `${this.baseUrl}/contas/${conta}/extrato?dataInicio=${from}&dataFim=${to}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`BB extrato error: ${res.status}`);
    const data = await res.json() as { lancamentos?: unknown[] };
    return data.lancamentos ?? [];
  }
}
