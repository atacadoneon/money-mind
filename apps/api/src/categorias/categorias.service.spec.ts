import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { Categoria } from './entities/categoria.entity';

const makeCat = (o: Partial<Categoria> = {}): Categoria =>
  ({ id: 'cat-1', orgId: 'org-1', nome: 'Fornecedores', tipo: 'despesa', parentId: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as Categoria);

const makeQb = (rows: Categoria[] = [makeCat()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('CategoriasService', () => {
  let svc: CategoriasService;
  const repo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn().mockResolvedValue([makeCat()]),
    findOne: jest.fn().mockResolvedValue(makeCat()),
    create: jest.fn((x) => ({ id: 'cat-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    repo.findOne.mockResolvedValue(makeCat());
    const mod = await Test.createTestingModule({
      providers: [
        CategoriasService,
        { provide: getRepositoryToken(Categoria), useValue: repo },
      ],
    }).compile();
    svc = mod.get(CategoriasService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.meta.total).toBe(1);
  });

  it('list filters by tipo', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, tipo: 'despesa' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('tree returns nested structure', async () => {
    const parent = makeCat({ id: 'p1', parentId: null });
    const child = makeCat({ id: 'c1', parentId: 'p1' });
    repo.find.mockResolvedValueOnce([parent, child]);
    const res = await svc.tree('org-1');
    expect(res.data).toHaveLength(1);
    const top = res.data[0] as { children: unknown[] };
    expect(top.children).toHaveLength(1);
  });

  it('tree filters by tipo', async () => {
    repo.find.mockResolvedValueOnce([makeCat()]);
    await svc.tree('org-1', 'despesa');
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tipo: 'despesa' }) }));
  });

  it('get returns categoria', async () => {
    const c = await svc.get('org-1', 'cat-1');
    expect(c.id).toBe('cat-1');
  });

  it('get throws NotFoundException when missing', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('create saves entity', async () => {
    await svc.create('org-1', { nome: 'Teste', tipo: 'receita' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('update applies dto changes', async () => {
    await svc.update('org-1', 'cat-1', { nome: 'Novo' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1', 'cat-1');
    expect(res.deleted).toBe(true);
  });
});
