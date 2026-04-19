import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mercado Pago API stub */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(private readonly config: ConfigService) {}

  async getPayments(accessToken: string, options: { begin_date?: string; end_date?: string; offset?: number } = {}): Promise<unknown[]> {
    if (!accessToken) {
      this.logger.warn('MercadoPago accessToken not configured');
      return [];
    }

    const url = new URL(`${this.baseUrl}/v1/payments/search`);
    url.searchParams.set('sort', 'date_created');
    url.searchParams.set('criteria', 'desc');
    url.searchParams.set('limit', '100');
    if (options.offset) url.searchParams.set('offset', String(options.offset));
    if (options.begin_date) url.searchParams.set('begin_date', options.begin_date);
    if (options.end_date) url.searchParams.set('end_date', options.end_date);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`MercadoPago payments error: ${res.status}`);
    const data = await res.json() as { results?: unknown[] };
    return data.results ?? [];
  }
}
