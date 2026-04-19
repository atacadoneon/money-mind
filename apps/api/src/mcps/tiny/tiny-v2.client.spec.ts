import { TinyV2Client } from './tiny-v2.client';

describe('TinyV2Client', () => {
  describe('formatDate', () => {
    it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
      expect(TinyV2Client.formatDate('2026-05-10')).toBe('10/05/2026');
    });

    it('converte data com mês de 1 dígito corretamente', () => {
      expect(TinyV2Client.formatDate('2026-01-03')).toBe('03/01/2026');
    });
  });

  describe('baixarCP', () => {
    it('lança erro quando contaOrigem está vazio', async () => {
      const client = new TinyV2Client();
      await expect(
        client.baixarCP('token-fake', {
          id: '12345',
          data: '10/05/2026',
          valorPago: 100,
          contaOrigem: '',
        }),
      ).rejects.toThrow('contaOrigem é obrigatório');
    });

    it('lança erro quando contaOrigem é apenas espaços', async () => {
      const client = new TinyV2Client();
      await expect(
        client.baixarCP('token-fake', {
          id: '12345',
          data: '10/05/2026',
          valorPago: 100,
          contaOrigem: '   ',
        }),
      ).rejects.toThrow('contaOrigem é obrigatório');
    });
  });

  describe('rate limiting', () => {
    it('cliente é instanciável sem dependências', () => {
      expect(() => new TinyV2Client()).not.toThrow();
    });
  });
});
