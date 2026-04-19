import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ContasPagarService } from './contas-pagar.service';
import { ContaPagar } from './entities/conta-pagar.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

const makeEntity = (overrides: Partial<ContaPagar> = {}): ContaPagar => ({
  id: 'cp-1', orgId: 'org-1', companyId: 'company-1',
  situacao: 'aberto', valor: '100.00', valorPago: '0',
  juros: '0', multa: '0', desconto: '0',
  dataVencimento: '2026-05-10',
  descricao: 'Aluguel', marcadoresIds: [], parcelamento: {}, metadata: {},
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  ...overrides,
} as ContaPagar);

describe('ContasPagarService', () => {
  let svc: ContasPagarService;

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
    save: jest.fn(async (x) => ({ id: 'cp-1', ...x })),
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
        save: jest.fn(async (_Entity: unknown, x: unknown) => Array.isArray(x) ? x : x),
        softRemove: jest.fn(async () => undefined),
      };
      return fn(em);
    }),
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ContasPagarService,
        { provide: getRepositoryToken(ContaPagar), useValue: repo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    svc = mod.get(ContasPagarService);
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  it('create salva entidade e retorna com id', async () => {
    repo.create.mockReturnValue({ id: 'new-1', situacao: 'aberto', valor: '100.00' });
    repo.save.mockResolvedValue({ id: 'new-1', situacao: 'aberto', valor: '100.00' });
    const r = await svc.create('org-1', {
      companyId: '00000000-0000-0000-0000-000000000001',
      descricao: 'Aluguel', valor: 1500, dataVencimento: '2026-05-10',
    });
    expect(r.id).toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  // ─── baixar ───────────────────────────────────────────────────────────────

  it('baixar com valor total → situacao=pago', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ valor: '100.00', valorPago: '0' }));
    const r = await svc.baixar('org-1', 'cp-1', { valorPago: 100, dataPagamento: '2026-05-10' });
    expect((r as ContaPagar).situacao).toBe('pago');
  });

  it('baixar parcial → situacao=parcial', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ valor: '200.00', valorPago: '0' }));
    const r = await svc.baixar('org-1', 'cp-1', { valorPago: 100, dataPagamento: '2026-05-10' });
    expect((r as ContaPagar).situacao).toBe('parcial');
    expect((r as ContaPagar).valorPago).toBe('100.00');
  });

  it('baixar conta já paga lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'pago' }));
    await expect(svc.baixar('org-1', 'cp-1', { valorPago: 100, dataPagamento: '2026-05-10' }))
      .rejects.toThrow('Already paid');
  });

  it('baixar conta cancelada lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'cancelado' }));
    await expect(svc.baixar('org-1', 'cp-1', { valorPago: 100, dataPagamento: '2026-05-10' }))
      .rejects.toThrow('Cannot pay a cancelled title');
  });

  // ─── estornar ─────────────────────────────────────────────────────────────

  it('estornar resets valorPago e situacao', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'pago', valorPago: '100.00' }));
    const r = await svc.estornar('org-1', 'cp-1', 'Estorno teste');
    expect((r as ContaPagar).situacao).toBe('aberto');
    expect((r as ContaPagar).valorPago).toBe('0');
  });

  it('estornar registra audit log', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'pago', valorPago: '100.00' }));
    await svc.estornar('org-1', 'cp-1', 'motivo');
    expect(auditRepo.create).toHaveBeenCalled();
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  it('remove conta paga lança BadRequestException', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'pago' }));
    await expect(svc.remove('org-1', 'cp-1')).rejects.toThrow('Cannot delete a paid title');
  });

  it('remove conta aberta executa softRemove', async () => {
    repo.findOne.mockResolvedValue(makeEntity({ situacao: 'aberto' }));
    repo.softRemove.mockResolvedValue(undefined);
    const r = await svc.remove('org-1', 'cp-1');
    expect(r).toEqual({ id: 'cp-1', deleted: true });
  });

  // ─── bulkDelete ───────────────────────────────────────────────────────────

  it('bulkDelete retorna count correto', async () => {
    const ids = ['cp-1', 'cp-2'];
    repo.find.mockResolvedValue([makeEntity({ id: 'cp-1' }), makeEntity({ id: 'cp-2' })]);
    const r = await svc.bulkDelete('org-1', { ids });
    expect(r.deleted).toBe(2);
  });

  it('bulkDelete com ids inexistentes retorna 0', async () => {
    repo.find.mockResolvedValue([]);
    const r = await svc.bulkDelete('org-1', { ids: ['nao-existe'] });
    expect(r.deleted).toBe(0);
  });

  // ─── bulkBaixar ───────────────────────────────────────────────────────────

  it('bulkBaixar ignora contas já pagas', async () => {
    repo.find.mockResolvedValue([
      makeEntity({ id: 'cp-1', situacao: 'aberto', valor: '100.00', valorPago: '0' }),
      makeEntity({ id: 'cp-2', situacao: 'pago', valor: '200.00', valorPago: '200.00' }),
    ]);
    const r = await svc.bulkBaixar('org-1', {
      ids: ['cp-1', 'cp-2'],
      dataPagamento: '2026-05-10',
      contaBancariaId: '00000000-0000-0000-0000-000000000002',
    });
    expect(r.baixadas).toBe(1);
    expect(r.erros).toHaveLength(1);
  });

  // ─── importRows ───────────────────────────────────────────────────────────

  it('importRows skip linhas sem descricao', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue([]);
    const r = await svc.importRows('org-1', 'comp-1', [
      { descricao: '', valor: 100, dataVencimento: '2026-05-10' },
      { descricao: 'Valida', valor: 200, dataVencimento: '2026-05-10' },
    ]);
    expect(r.skipped).toBe(1);
  });

  it('importRows valida data inválida e reporta erro', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue([]);
    const r = await svc.importRows('org-1', 'comp-1', [
      { descricao: 'Teste', valor: 100, dataVencimento: '10/05/2026' },
    ]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].error).toContain('dataVencimento');
  });
});
