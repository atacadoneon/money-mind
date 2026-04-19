import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PagarmeOrder {
  id: string;
  code?: string;
  status: string;
  amount: number;
  customer?: { name?: string };
  charges?: Array<{ payment_method?: string; installments?: number; last_transaction?: { amount?: number; fee?: number } }>;
  created_at: string;
  closed_at?: string;
}

/**
 * Pagar.me v5 client — REAL implementation.
 * Auth: Basic com api_key como username, senha vazia.
 * GET /orders?page=1&size=100&created_since=X
 * Paginação via paging.next URL.
 */
@Injectable()
export class PagarmeClient {
  private readonly logger = new Logger(PagarmeClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('PAGARME_BASE_URL', 'https://api.pagar.me/core/v5');
  }

  private getAuthHeader(apiKey: string): string {
    return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  }

  async getOrders(
    apiKey: string,
    options: { createdSince?: string; page?: number; size?: number } = {},
  ): Promise<{ orders: PagarmeOrder[]; nextUrl?: string }> {
    if (!apiKey) {
      this.logger.warn('Pagar.me apiKey not configured');
      return { orders: [] };
    }

    const url = new URL(`${this.baseUrl}/orders`);
    url.searchParams.set('size', String(options.size ?? 100));
    url.searchParams.set('page', String(options.page ?? 1));
    if (options.createdSince) url.searchParams.set('created_since', options.createdSince);

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.getAuthHeader(apiKey), 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`Pagar.me orders error: ${res.status} ${await res.text()}`);

    const data = await res.json() as { data?: PagarmeOrder[]; paging?: { next?: string } };
    return {
      orders: data.data ?? [],
      nextUrl: data.paging?.next,
    };
  }

  /** Pagina automaticamente até o fim ou limite de páginas */
  async getAllOrders(apiKey: string, createdSince?: string, maxPages = 50): Promise<PagarmeOrder[]> {
    if (!apiKey) return [];

    const all: PagarmeOrder[] = [];
    let page = 1;

    while (page <= maxPages) {
      const { orders, nextUrl } = await this.getOrders(apiKey, { createdSince, page });
      all.push(...orders);
      if (!nextUrl || !orders.length) break;
      page++;
    }

    return all;
  }

  normalizeOrder(order: PagarmeOrder, companyId: string) {
    const charge = order.charges?.[0];
    const taxa = charge?.last_transaction?.fee ?? 0;
    const valorBruto = order.amount / 100;
    const valorTaxa = taxa / 100;

    return {
      companyId,
      gateway: 'pagarme' as const,
      externalId: order.id,
      valorBruto,
      valorTaxa,
      valorLiquido: valorBruto - valorTaxa,
      status: order.status,
      pedidoRef: order.code ?? order.id,
      clienteNome: order.customer?.name ?? '',
      parcelas: charge?.installments ?? 1,
      dataTransacao: order.created_at.substring(0, 10),
      dataLiquidacao: order.closed_at?.substring(0, 10) ?? null,
      rawData: order as unknown as object,
    };
  }
}
