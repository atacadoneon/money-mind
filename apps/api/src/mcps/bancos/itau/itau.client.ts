import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Itaú Developer Portal client — stub funcional.
 * Base: https://devportal.itau.com.br
 */
@Injectable()
export class ItauClient {
  private readonly logger = new Logger(ItauClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('ITAU_BASE_URL', 'https://sandbox.devportal.itau.com.br');
  }

  private async getToken(credentials: Record<string, string>): Promise<string> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret) return 'stub-token';

    const res = await fetch(`${this.baseUrl}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
    });
    if (!res.ok) return 'stub-token';
    const d = await res.json() as { access_token: string };
    return d.access_token;
  }

  async getSaldo(credentials: Record<string, string>, agencia: string, conta: string) {
    const token = await this.getToken(credentials);
    if (token === 'stub-token') return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };

    const res = await fetch(`${this.baseUrl}/banking/v2/accounts/${agencia}/${conta}/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Itaú saldo error: ${res.status}`);
    return res.json();
  }

  async getExtrato(credentials: Record<string, string>, agencia: string, conta: string, from: string, to: string): Promise<unknown[]> {
    const token = await this.getToken(credentials);
    if (token === 'stub-token') {
      this.logger.warn('Itaú extrato returning stub');
      return [];
    }

    const res = await fetch(
      `${this.baseUrl}/banking/v2/accounts/${agencia}/${conta}/transactions?dtInicio=${from}&dtFim=${to}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Itaú extrato error: ${res.status}`);
    const data = await res.json() as { transactions?: unknown[] };
    return data.transactions ?? [];
  }
}
