import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Stripe API stub — para clientes internacionais futuros */
@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(private readonly config: ConfigService) {}

  private getAuthHeader(secretKey: string): string {
    return `Bearer ${secretKey}`;
  }

  async getCharges(secretKey: string, options: { createdGte?: number; limit?: number } = {}): Promise<unknown[]> {
    if (!secretKey) {
      this.logger.warn('Stripe secretKey not configured');
      return [];
    }

    const url = new URL(`${this.baseUrl}/charges`);
    url.searchParams.set('limit', String(options.limit ?? 100));
    if (options.createdGte) url.searchParams.set('created[gte]', String(options.createdGte));

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.getAuthHeader(secretKey) },
    });

    if (!res.ok) throw new Error(`Stripe charges error: ${res.status}`);
    const data = await res.json() as { data?: unknown[] };
    return data.data ?? [];
  }
}
