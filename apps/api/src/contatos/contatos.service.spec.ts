import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { Contato } from './entities/contato.entity';

const makeContato = (o: Partial<Contato> = {}): Contato =>
  ({ id: 'ct-1', orgId: 'org-1', nome: 'Fornecedor X', tipo: 'fornecedor', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), endereco: {}, ...o } as Contato);

const makeQb = (rows: Contato[] = [makeContato()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('ContatosService', () => {
  let svc: ContatosService;
  const repo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(makeContato()),
    create: jest.fn((x) => ({ id: 'ct-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    repo.findOne.mockResolvedValue(makeContato());
    const mod = await Test.createTestingModule({
      providers: [
        ContatosService,
        { provide: getRepositoryToken(Contato), useValue: repo },
      ],
    }).compile();
    svc = mod.get(ContatosService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
  });

  it('list applies tipo filter', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, tipo: 'cliente' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('list applies search', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, search: 'X' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('get returns contato', async () => {
    const c = await svc.get('org-1', 'ct-1');
    expect(c.id).toBe('ct-1');
  });

  it('get throws NotFoundException', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('create saves contato', async () => {
    await svc.create('org-1', { nome: 'Novo', tipo: 'cliente' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('update applies changes', async () => {
    await svc.update('org-1', 'ct-1', { nome: 'Updated' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1', 'ct-1');
    expect(res.deleted).toBe(true);
  });
});
