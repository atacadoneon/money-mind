import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { BillingService } from '../billing/billing.service';

const makeOrg = (o: Partial<Organization> = {}): Organization =>
  ({ id: 'org-1', name: 'Test Org', slug: 'test-org', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as Organization);

const makeQb = (rows: Organization[] = [makeOrg()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('OrganizationsService', () => {
  let svc: OrganizationsService;
  const repo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(makeOrg()),
    create: jest.fn((x) => ({ id: 'org-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    repo.findOne.mockResolvedValue(makeOrg());
    const mod = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: getRepositoryToken(Organization), useValue: repo },
        { provide: BillingService, useValue: { initTrialForOrg: jest.fn() } },
      ],
    }).compile();
    svc = mod.get(OrganizationsService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list({ page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('list applies search', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list({ page: 1, limit: 25, search: 'Test' } as never);
    expect(mockQb.andWhere).toHaveBeenCalled();
  });

  it('get returns org', async () => {
    const o = await svc.get('org-1');
    expect(o.id).toBe('org-1');
  });

  it('get throws NotFoundException', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('missing')).rejects.toThrow(NotFoundException);
  });

  it('create saves org', async () => {
    await svc.create({ name: 'New', slug: 'new' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('update assigns dto', async () => {
    await svc.update('org-1', { name: 'Updated' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1');
    expect(res.deleted).toBe(true);
  });
});
