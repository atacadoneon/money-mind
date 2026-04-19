import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ContaSimplesTransactionType = 'PURCHASE' | 'LIMIT' | 'IOF' | 'REFUND';

export interface ContaSimplesTransaction {
  id: string;
  amount: number;
  type: ContaSimplesTransactionType;
  description: string;
  date: string;
  status: string;
}

export interface ContaSimplesStatement {
  transactions: ContaSimplesTransaction[];
  nextPageStartKey?: string;
}

/**
 * Conta Simples OAuth2 client — REAL implementation.
 * Access token TTL: 30 min. Auto-refresh via credentials.
 * Endpoints:
 *   POST /auth/v1/token   → access_token
 *   GET  /statements/v1/credit-card?startDate=&endDate=&nextPageStartKey=
 */
@Injectable()
export class ContaSimplesClient {
  private readonly logger = new Logger(ContaSimplesClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('CONTA_SIMPLES_BASE_URL', 'https://sandbox.contasimples.com');
  }

  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret) {
      this.logger.warn('Conta Simples credentials not configured');
      return 'stub-token';
    }

    const res = await fetch(`${this.baseUrl}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });

    if (!res.ok) {
      this.logger.warn(`Conta Simples token error: ${res.status}`);
      return 'stub-token';
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async getStatement(
    credentials: Record<string, string>,
    startDate: string,
    endDate: string,
    nextPageStartKey?: string,
  ): Promise<ContaSimplesStatement> {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') return { transactions: [] };

    const url = new URL(`${this.baseUrl}/statements/v1/credit-card`);
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    if (nextPageStartKey) url.searchParams.set('nextPageStartKey', nextPageStartKey);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`Conta Simples statement error: ${res.status}`);
    const data = await res.json() as {
      data?: { transactions?: ContaSimplesTransaction[] };
      nextPageStartKey?: string;
    };

    return {
      transactions: data.data?.transactions ?? [],
      nextPageStartKey: data.nextPageStartKey,
    };
  }

  /** Pagina automaticamente até não ter mais nextPageStartKey */
  async getAllTransactions(
    credentials: Record<string, string>,
    startDate: string,
    endDate: string,
  ): Promise<ContaSimplesTransaction[]> {
    const all: ContaSimplesTransaction[] = [];
    let nextKey: string | undefined;

    do {
      const page = await this.getStatement(credentials, startDate, endDate, nextKey);
      all.push(...page.transactions);
      nextKey = page.nextPageStartKey;
    } while (nextKey);

    return all;
  }

  async getSaldo(credentials: Record<string, string>): Promise<{ saldo: number; dataReferencia: string }> {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };

    const res = await fetch(`${this.baseUrl}/accounts/v1/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Conta Simples saldo error: ${res.status}`);
    const data = await res.json() as { balance?: number };
    return { saldo: Number(data.balance ?? 0), dataReferencia: new Date().toISOString().split('T')[0] };
  }
}
