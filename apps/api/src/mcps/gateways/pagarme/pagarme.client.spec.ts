import { PagarmeClient } from './pagarme.client';
import { ConfigService } from '@nestjs/config';

describe('PagarmeClient', () => {
  let client: PagarmeClient;

  beforeEach(() => {
    const cs = { get: jest.fn().mockReturnValue('https://api.pagar.me/core/v5') } as unknown as ConfigService;
    client = new PagarmeClient(cs);
  });

  describe('getAllOrders', () => {
    it('should return empty array when apiKey is missing', async () => {
      const orders = await client.getAllOrders('');
      expect(orders).toEqual([]);
    });
  });

  describe('normalizeOrder', () => {
    it('should normalize order correctly', () => {
      const mockOrder = {
        id: 'or_test123',
        code: 'PED001',
        status: 'paid',
        amount: 15000,
        customer: { name: 'João Silva' },
        charges: [{ installments: 2, last_transaction: { amount: 15000, fee: 450 } }],
        created_at: '2024-01-15T10:00:00Z',
        closed_at: '2024-01-15T10:01:00Z',
      };

      const result = client.normalizeOrder(mockOrder, 'company-uuid');

      expect(result.valorBruto).toBe(150);
      expect(result.valorTaxa).toBe(4.5);
      expect(result.valorLiquido).toBe(145.5);
      expect(result.gateway).toBe('pagarme');
      expect(result.externalId).toBe('or_test123');
      expect(result.clienteNome).toBe('João Silva');
      expect(result.parcelas).toBe(2);
      expect(result.dataTransacao).toBe('2024-01-15');
    });

    it('should handle order without charges', () => {
      const mockOrder = {
        id: 'or_test456',
        status: 'pending',
        amount: 5000,
        created_at: '2024-01-15T10:00:00Z',
        charges: [],
      };

      const result = client.normalizeOrder(mockOrder, 'company-uuid');
      expect(result.valorTaxa).toBe(0);
      expect(result.parcelas).toBe(1);
    });
  });
});
