import { ContaSimplesClient } from './conta-simples.client';
import { ConfigService } from '@nestjs/config';

describe('ContaSimplesClient', () => {
  let client: ContaSimplesClient;

  beforeEach(() => {
    const cs = { get: jest.fn().mockReturnValue('https://sandbox.contasimples.com') } as unknown as ConfigService;
    client = new ContaSimplesClient(cs);
  });

  it('should return stub when credentials missing', async () => {
    const result = await client.getStatement({}, '2024-01-01', '2024-01-31');
    expect(result.transactions).toEqual([]);
    expect(result.nextPageStartKey).toBeUndefined();
  });

  it('should return stub saldo when credentials missing', async () => {
    const result = await client.getSaldo({});
    expect(result.saldo).toBe(0);
    expect(result.dataReferencia).toBeTruthy();
  });

  it('should return empty array from getAllTransactions without credentials', async () => {
    const result = await client.getAllTransactions({}, '2024-01-01', '2024-01-31');
    expect(result).toEqual([]);
  });
});
