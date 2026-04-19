import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RelatoriosService } from './relatorios.service';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

const makeQb = (raw: unknown[] = []) => ({
  createQueryBuilder: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(raw),
  getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
});

describe('RelatoriosService', () => {
  let service: RelatoriosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatoriosService,
        {
          provide: getRepositoryToken(ContaPagar),
          useFactory: () => makeQb([{ categoria_id: 'cat-1', total: '500' }]),
        },
        {
          provide: getRepositoryToken(ContaReceber),
          useFactory: () => makeQb([{ categoria_id: 'cat-2', total: '1200' }]),
        },
      ],
    }).compile();

    service = module.get<RelatoriosService>(RelatoriosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return DRE structure', async () => {
    const dre = await service.getDre('org-uuid', 'company-uuid', '2024-01-01', '2024-01-31');
    expect(dre).toHaveProperty('periodo');
    expect(dre).toHaveProperty('receitas');
    expect(dre).toHaveProperty('despesas');
    expect(dre).toHaveProperty('totalReceitas');
    expect(dre).toHaveProperty('totalDespesas');
    expect(dre).toHaveProperty('resultadoLiquido');
    expect(dre.periodo.from).toBe('2024-01-01');
  });

  it('should return fluxo caixa as array', async () => {
    const fluxo = await service.getFluxoCaixa('org-uuid', 'company-uuid', 30, 'dia');
    expect(Array.isArray(fluxo)).toBe(true);
  });
});
