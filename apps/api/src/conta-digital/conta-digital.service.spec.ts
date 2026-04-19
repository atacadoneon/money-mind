import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContaDigitalService } from './conta-digital.service';
import { ContaBancaria } from '../contas-bancarias/entities/conta-bancaria.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

const mockConta: Partial<ContaBancaria> = {
  id: 'conta-uuid',
  orgId: 'org-uuid',
  companyId: 'company-uuid',
  nome: 'Sicoob Corrente',
  bancoCodigo: '756',
  bancoNome: 'Sicoob',
  saldoInicial: '5000',
  saldoAtual: '5000',
  isActive: true,
  agencia: '0001',
  contaNumero: '123456-7',
};

const makeQb = (rows: unknown[] = []) => ({
  createQueryBuilder: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
  getRawOne: jest.fn().mockResolvedValue({ saldo: '1500' }),
});

describe('ContaDigitalService', () => {
  let service: ContaDigitalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContaDigitalService,
        {
          provide: getRepositoryToken(ContaBancaria),
          useValue: {
            find: jest.fn().mockResolvedValue([mockConta]),
            ...makeQb(),
          },
        },
        { provide: getRepositoryToken(ExtratoLinha), useFactory: () => makeQb([]) },
        { provide: getRepositoryToken(ContaPagar), useFactory: () => makeQb([]) },
        { provide: getRepositoryToken(ContaReceber), useFactory: () => makeQb([]) },
      ],
    }).compile();

    service = module.get<ContaDigitalService>(ContaDigitalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return contas with saldoCalculado', async () => {
    const contas = await service.getContas('org-uuid', 'company-uuid');
    expect(Array.isArray(contas)).toBe(true);
    expect(contas[0]).toHaveProperty('saldoCalculado');
  });

  it('should return saldo consolidado', async () => {
    const result = await service.getSaldoConsolidado('org-uuid', 'company-uuid');
    expect(result).toHaveProperty('saldoConsolidado');
    expect(result).toHaveProperty('quantidadeContas');
    expect(result.quantidadeContas).toBe(1);
  });
});
