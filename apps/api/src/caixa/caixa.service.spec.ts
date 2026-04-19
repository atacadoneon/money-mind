import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CaixaService } from './caixa.service';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';

const mockRepo = () => ({
  createQueryBuilder: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({ total: '1000' }),
  getRawMany: jest.fn().mockResolvedValue([]),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
});

describe('CaixaService', () => {
  let service: CaixaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaixaService,
        { provide: getRepositoryToken(ContaPagar), useFactory: mockRepo },
        { provide: getRepositoryToken(ContaReceber), useFactory: mockRepo },
        { provide: getRepositoryToken(ExtratoLinha), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<CaixaService>(CaixaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return saldo structure', async () => {
    const result = await service.getSaldo('org-uuid', 'company-uuid');
    expect(result).toHaveProperty('saldoAtual');
    expect(result).toHaveProperty('entradasDia');
    expect(result).toHaveProperty('saidasDia');
    expect(result).toHaveProperty('saldoInicialDia');
  });

  it('should return lancamentos with data and total', async () => {
    const result = await service.getLancamentos('org-uuid', 'company-uuid', {
      from: '2024-01-01',
      to: '2024-01-31',
    });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.data)).toBe(true);
  });
});
