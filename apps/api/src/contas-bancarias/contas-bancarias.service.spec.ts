import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContasBancariasService } from './contas-bancarias.service';
import { ContaBancaria } from './entities/conta-bancaria.entity';

const makeCB = (o: Partial<ContaBancaria> = {}): ContaBancaria =>
  ({ id: 'cb-1', orgId: 'org-1', companyId: 'co-1', nome: 'Conta Principal', tipo: 'corrente', bancoSlug: 'itau', agencia: '0001', conta: '12345-6', saldoInicial: '1000', saldoAtual: '1200', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as ContaBancaria);

const makeQb = (rows: ContaBancaria[] = [makeCB()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('ContasBancariasService', () => {
  let svc: ContasBancariasService;
  const repo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(makeCB()),
    create: jest.fn((x) => ({ id: 'cb-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    repo.findOne.mockResolvedValue(makeCB());
    const mod = await Test.createTestingModule({
      providers: [
        ContasBancariasService,
        { provide: getRepositoryToken(ContaBancaria), useValue: repo },
      ],
    }).compile();
    svc = mod.get(ContasBancariasService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
  });

  it('list filters by companyId', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, companyId: 'co-1' } as never);
    expect(mockQb.andWhere).toHaveBeenCalledWith('cb.company_id = :cid', { cid: 'co-1' });
  });

  it('get returns conta', async () => {
    const c = await svc.get('org-1', 'cb-1');
    expect(c.id).toBe('cb-1');
  });

  it('get throws NotFoundException', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('create sets saldoAtual from saldoInicial', async () => {
    await svc.create('org-1', { companyId: 'co-1', nome: 'Nova', tipo: 'corrente', saldoInicial: 500 } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ saldoInicial: '500', saldoAtual: '500' }));
  });

  it('update applies changes', async () => {
    await svc.update('org-1', 'cb-1', { nome: 'Updated' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1', 'cb-1');
    expect(res.deleted).toBe(true);
  });
});
