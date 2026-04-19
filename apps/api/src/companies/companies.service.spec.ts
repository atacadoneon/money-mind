import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { EncryptionService } from '../common/services/encryption.service';

const makeCompany = (o: Partial<Company> = {}): Company =>
  ({ id: 'co-1', orgId: 'org-1', name: 'ACME', tradeName: undefined, cnpj: '00000000000001', ie: undefined, deletedAt: null, settings: {}, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...o } as Company);

const qb = () => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[makeCompany()], 1]),
});

describe('CompaniesService', () => {
  let svc: CompaniesService;
  const repo = {
    createQueryBuilder: jest.fn(qb),
    findOne: jest.fn().mockResolvedValue(makeCompany()),
    create: jest.fn((x) => ({ ...x })),
    save: jest.fn(async (x) => ({ id: 'co-1', ...x })),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };
  const crypto = { encrypt: jest.fn((t) => `enc:${t}`), decrypt: jest.fn((t) => t.replace('enc:', '')) };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(qb);
    repo.findOne.mockResolvedValue(makeCompany());
    const mod = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: repo },
        { provide: EncryptionService, useValue: crypto },
      ],
    }).compile();
    svc = mod.get(CompaniesService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated data', async () => {
    const result = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('list applies search filter', async () => {
    const mockQb = qb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, search: 'ACME' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('get returns company', async () => {
    const c = await svc.get('org-1', 'co-1');
    expect(c.id).toBe('co-1');
  });

  it('get throws NotFoundException when not found', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'no')).rejects.toThrow(NotFoundException);
  });

  it('create without tokens', async () => {
    await svc.create('org-1', { name: 'New Co' } as never);
    expect(repo.save).toHaveBeenCalled();
    expect(crypto.encrypt).not.toHaveBeenCalled();
  });

  it('update patches name', async () => {
    await svc.update('org-1', 'co-1', { name: 'Updated' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const result = await svc.remove('org-1', 'co-1');
    expect(result.deleted).toBe(true);
    expect(repo.softRemove).toHaveBeenCalled();
  });
});
