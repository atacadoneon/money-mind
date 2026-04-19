import { AppmaxClient } from './appmax.client';

describe('AppmaxClient', () => {
  let client: AppmaxClient;

  beforeEach(() => {
    client = new AppmaxClient();
  });

  describe('parseCSV', () => {
    it('should parse CSV with semicolon delimiter', () => {
      const csv = Buffer.from(
        'id_pedido;total_venda;total_liquido;parcelas;tipo_pagamento;data;status;cliente\n' +
        '1001;100,00;97,00;1;credito;2024-01-15;capturado;Maria Souza\n' +
        '1002;200,00;194,00;2;credito;2024-01-16;capturado;Carlos Lima',
      );

      const rows = client.parseCSV(csv, 'company-uuid');

      expect(rows).toHaveLength(2);
      expect(rows[0].externalId).toBe('1001');
      expect(rows[0].valorBruto).toBe(100);
      expect(rows[0].valorLiquido).toBe(97);
      expect(rows[0].parcelas).toBe(1);
      expect(rows[0].gateway).toBe('appmax');
      expect(rows[1].valorBruto).toBe(200);
    });

    it('should use 3% default tax when total_liquido is missing', () => {
      const csv = Buffer.from(
        'id_pedido;total_venda;total_liquido;parcelas;tipo_pagamento;data\n' +
        '2001;1000,00;;1;pix;2024-01-20',
      );

      const rows = client.parseCSV(csv, 'company-uuid');
      expect(rows[0].valorTaxa).toBeCloseTo(30, 1);
    });

    it('should return empty array for empty CSV', () => {
      const rows = client.parseCSV(Buffer.from(''), 'company-uuid');
      expect(rows).toEqual([]);
    });
  });
});
