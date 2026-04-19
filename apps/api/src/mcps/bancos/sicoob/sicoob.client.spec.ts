import { SicoobClient } from './sicoob.client';
import { ConfigService } from '@nestjs/config';

describe('SicoobClient', () => {
  let client: SicoobClient;

  beforeEach(() => {
    const cs = {
      get: jest.fn().mockReturnValue('https://sandbox.sicoob.com.br/sicoob/sandbox'),
    } as unknown as ConfigService;
    client = new SicoobClient(cs);
  });

  it('should return stub saldo when credentials missing', async () => {
    const result = await client.getSaldo({}, '0001', '123456-7');
    expect(result.saldo).toBe(0);
    expect(result.dataReferencia).toBeTruthy();
  });

  it('should return empty extrato when credentials missing', async () => {
    const result = await client.getExtrato({}, '0001', '123456-7', '2024-01-01', '2024-01-31');
    expect(result).toEqual([]);
  });

  it('should return stub boleto when credentials missing', async () => {
    const boleto = await client.emitirBoleto({}, {
      valor: 100,
      vencimento: '2024-02-01',
      sacadoNome: 'João Silva',
      sacadoCpfCnpj: '000.000.000-00',
    });
    expect(boleto.nossoNumero).toMatch(/^STUB-/);
    expect(boleto.linhaDigitavel).toBeTruthy();
  });

  it('should not throw on cancelarBoleto without credentials', async () => {
    await expect(client.cancelarBoleto({}, 'STUB-123')).resolves.not.toThrow();
  });
});
