import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MarcadoresService } from './marcadores.service';
import { Marcador } from './entities/marcador.entity';

const makeMarcador = (o: Partial<Marcador> = {}): Marcador =>
  ({ id: 'm-1', orgId: 'org-1', nome: 'Urgente', cor: '#ff0000', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as Marcador);

const makeQb = (rows: Marcador[] = [makeMarcador()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('MarcadoresService', () => {
  let svc: MarcadoresService;
  const repo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(makeMarcador()),
    create: jest.fn((x) => ({ id: 'm-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    repo.findOne.mockResolvedValue(makeMarcador());
    const mod = await Test.createTestingModule({
      providers: [
        MarcadoresService,
        { provide: getRepositoryToken(Marcador), useValue: repo },
      ],
    }).compile();
    svc = mod.get(MarcadoresService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
  });

  it('list applies search', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, search: 'Urg' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('get returns marcador', async () => {
    const m = await svc.get('org-1', 'm-1');
    expect(m.id).toBe('m-1');
  });

  it('get throws NotFoundException', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('create saves', async () => {
    await svc.create('org-1', { nome: 'Nova', cor: '#00ff00' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('update applies changes', async () => {
    await svc.update('org-1', 'm-1', { nome: 'Edited' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1', 'm-1');
    expect(res.deleted).toBe(true);
  });
});
