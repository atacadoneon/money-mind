import { Injectable, Logger } from '@nestjs/common';

export interface AppmaxRow {
  id_pedido: string;
  total_venda: string;
  total_liquido: string;
  parcelas: string;
  tipo_pagamento: string;
  data: string;
  status?: string;
  cliente?: string;
}

/**
 * Appmax client — upload manual de CSV.
 * Campos: id_pedido, total_venda, total_liquido, parcelas, tipo_pagamento, taxa 3%.
 */
@Injectable()
export class AppmaxClient {
  private readonly logger = new Logger(AppmaxClient.name);
  private readonly TAXA_DEFAULT = 0.03;

  parseCSV(csvBuffer: Buffer, companyId: string) {
    const text = csvBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];

    const header = lines[0].split(';').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const rows: AppmaxRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map((v) => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
      rows.push(row as unknown as AppmaxRow);
    }

    return rows.map((row) => {
      const valorBruto = parseFloat(String(row.total_venda ?? '0').replace(',', '.')) || 0;
      const valorLiquido = parseFloat(String(row.total_liquido ?? '0').replace(',', '.')) || 0;
      const valorTaxa = valorBruto > 0 && valorLiquido > 0
        ? valorBruto - valorLiquido
        : valorBruto * this.TAXA_DEFAULT;

      return {
        companyId,
        gateway: 'appmax' as const,
        externalId: String(row.id_pedido ?? ''),
        valorBruto,
        valorTaxa,
        valorLiquido: valorBruto - valorTaxa,
        status: row.status ?? 'capturado',
        pedidoRef: String(row.id_pedido ?? ''),
        clienteNome: row.cliente ?? '',
        parcelas: parseInt(String(row.parcelas ?? '1'), 10) || 1,
        dataTransacao: row.data?.substring(0, 10) ?? new Date().toISOString().split('T')[0],
        dataLiquidacao: null as string | null,
        rawData: row as unknown as object,
      };
    });
  }
}
