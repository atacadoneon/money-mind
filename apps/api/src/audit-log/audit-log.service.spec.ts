import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';

const makeLog = (o: Partial<AuditLog> = {}): AuditLog =>
  ({ id: 'al-1', orgId: 'org-1', actorId: 'user-1', action: 'create', entityType: 'conta-pagar', entityId: 'cp-1', changes: {}, createdAt: new Date(), ...o } as AuditLog);

const makeQb = (rows: AuditLog[] = [makeLog()]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
});

describe('AuditLogService', () => {
  let svc: AuditLogService;
  const repo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn((x) => ({ id: 'al-new', ...x })),
    save: jest.fn(async (x) => x),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.createQueryBuilder.mockImplementation(() => makeQb());
    const mod = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();
    svc = mod.get(AuditLogService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('log creates and saves entry', async () => {
    await svc.log({ orgId: 'org-1', action: 'create', entityType: 'companies', entityId: 'c-1', changes: {} });
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  it('list returns paginated logs', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('list filters by entity', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, entityType: 'companies' } as never);
    expect(mockQb.andWhere).toHaveBeenCalledWith('a.entity_type = :e', { e: 'companies' });
  });

  it('list filters by entityId', async () => {
    const mockQb = makeQb();
    repo.createQueryBuilder.mockReturnValue(mockQb);
    await svc.list('org-1', { page: 1, limit: 25, entityId: 'c-1' } as never);
    expect(mockQb.andWhere).toHaveBeenCalledWith('a.entity_id = :eid', { eid: 'c-1' });
  });

  it('log can record update action', async () => {
    const entry = await svc.log({ orgId: 'org-1', action: 'update', entityType: 'companies', changes: { name: 'New' } });
    expect(entry).toBeDefined();
  });
});
