import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Olist Digital / Banco do Tiny — wrapper via Tiny API.
 * Reutiliza token Tiny v2 (HMAC) para operações bancárias integradas.
 */
@Injectable()
export class OlistClient {
  private readonly logger = new Logger(OlistClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('TINY_API_URL', 'https://api.tiny.com.br/api2');
  }

  async getSaldo(credentials: Record<string, string>): Promise<{ saldo: number; dataReferencia: string }> {
    const token = credentials.apiKey;
    if (!token) return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };

    // Olist Digital saldo via Tiny conta-digital endpoint
    const res = await fetch(`${this.baseUrl}/financeiro.conta.digital.saldo.obter.php?token=${token}&formato=json`);
    if (!res.ok) return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };

    const data = await res.json() as { retorno?: { saldo?: number } };
    return {
      saldo: Number(data.retorno?.saldo ?? 0),
      dataReferencia: new Date().toISOString().split('T')[0],
    };
  }

  async getExtrato(credentials: Record<string, string>, from: string, to: string): Promise<unknown[]> {
    const token = credentials.apiKey;
    if (!token) {
      this.logger.warn('Olist extrato returning stub');
      return [];
    }

    const res = await fetch(
      `${this.baseUrl}/financeiro.conta.digital.extrato.obter.php?token=${token}&dataInicial=${from}&dataFinal=${to}&formato=json`,
    );
    if (!res.ok) return [];
    const data = await res.json() as { retorno?: { lancamentos?: unknown[] } };
    return data.retorno?.lancamentos ?? [];
  }
}
