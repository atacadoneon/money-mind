import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ContasReceberService } from './contas-receber.service';
import { ContaReceber } from './entities/conta-receber.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

const makeEntity = (overrides: Partial<ContaReceber> = {}): ContaReceber => ({
  id: 'cr-1', orgId: 'org-1', companyId: 'company-1',
  situacao: 'aberto', valor: '150.00', valorRecebido: '0',
  juros: '0', multa: '0', desconto: '0',
  dataVencimento: '2026-05-15',
  descricao: 'Venda produto', marcadoresIds: [], metadata: {},
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
} as ContaReceber);

describe('ContasReceberService', () => {
  let svc: ContasReceberService;

  const repo: Record<string, jest.Mock> = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn((x) => ({ ...x, id: 'new-1' })),
    save: jest.fn(async (x) => ({ id: 'cr-1', ...x })),
    findOne: jest.fn(async () => makeEntity()),
    find: jest.fn(async () => []),
    softRemove: jest.fn(async () => undefined),
  };

  const auditRepo: Record<string, jest.Mock> = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (em: unknown) => Promise<unknown>) => {
      const em = {
        save: jest.fn(async (_E: unknown, x: unknown) => x),
        softRemove: jest.fn(async () => undefined),
      };
      return fn(em);
    }),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ContasReceberService,
        { provide: getRepositoryToken(ContaReceber), useValue: repo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    svc = mod.get(ContasReceberService);
    jest.clearAllMocks();
  });

  it('criar CR retorna entidade com id', async () => {
    repo.create.mockReturnValue({ id: 'new-1', situacao: 'aberto', valor: '150.00' });
    repo.save.mockResolvedValue({ id: 'new-1', situacao: 'aberto', valor: '150.00' });
    const r = await svc.create('org-1', {
      companyId: '00000000-0000-0000-0000-000000000001',
      descricao: 'Venda', valor: 150, dataVencimento: '2026-05-15',
    });
    expect(r.id).toBeDefined();
  });

  it('baixar com valor total → situacao=recebido', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ valor: '150.00', valorRecebido: '0' }));
    const r = await svc.baixar('org-1', 'cr-1', { valorRecebido: 150, dataRecebimento: '2026-05-15' });
    expect((r as ContaReceber).situacao).toBe('recebido');
  });

  it('baixar parcial → situacao=parcial', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ valor: '300.00', valorRecebido: '0' }));
    const r = await svc.baixar('org-1', 'cr-1', { valorRecebido: 100, dataRecebimento: '2026-05-15' });
    expect((r as ContaReceber).situacao).toBe('parcial');
  });

  it('baixar CR já recebida lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'recebido' }));
    await expect(svc.baixar('org-1', 'cr-1', { valorRecebido: 100, dataRecebimento: '2026-05-15' }))
      .rejects.toThrow('Already received');
  });

  it('baixar CR cancelada lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'cancelado' }));
    await expect(svc.baixar('org-1', 'cr-1', { valorRecebido: 100, dataRecebimento: '2026-05-15' }))
      .rejects.toThrow('Cannot receive a cancelled title');
  });

  it('estornar CR reseta valorRecebido e situacao', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'recebido', valorRecebido: '150.00' }));
    const r = await svc.estornar('org-1', 'cr-1', 'Estorno');
    expect((r as ContaReceber).situacao).toBe('aberto');
    expect((r as ContaReceber).valorRecebido).toBe('0');
  });

  it('remove CR recebida lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'recebido' }));
    await expect(svc.remove('org-1', 'cr-1')).rejects.toThrow('Cannot delete a received title');
  });

  it('bulkDelete retorna count correto', async () => {
    repo.find.mockResolvedValue([makeEntity({ id: 'cr-1' }), makeEntity({ id: 'cr-2' })]);
    const r = await svc.bulkDelete('org-1', { ids: ['cr-1', 'cr-2'] });
    expect(r.deleted).toBe(2);
  });

  it('bulkBaixar processa apenas contas abertas', async () => {
    repo.find.mockResolvedValue([
      makeEntity({ id: 'cr-1', situacao: 'aberto', valor: '100.00', valorRecebido: '0' }),
      makeEntity({ id: 'cr-2', situacao: 'recebido', valor: '200.00', valorRecebido: '200.00' }),
    ]);
    const r = await svc.bulkBaixar('org-1', {
      ids: ['cr-1', 'cr-2'],
      dataRecebimento: '2026-05-15',
      contaBancariaId: '00000000-0000-0000-0000-000000000002',
    });
    expect(r.baixadas).toBe(1);
    expect(r.erros).toHaveLength(1);
  });

  it('importRows com dados válidos importa corretamente', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue([]);
    const r = await svc.importRows('org-1', 'comp-1', [
      { descricao: 'Venda A', valor: 100, dataVencimento: '2026-05-10' },
      { descricao: 'Venda B', valor: 200, dataVencimento: '2026-05-15' },
    ]);
    expect(r.skipped).toBe(0);
  });

  it('importRows com data inválida reporta erro', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue([]);
    const r = await svc.importRows('org-1', 'comp-1', [
      { descricao: 'Teste', valor: 100, dataVencimento: '10/05/2026' },
    ]);
    expect(r.errors).toHaveLength(1);
  });
});
