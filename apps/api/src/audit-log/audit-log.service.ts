import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { buildMeta, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(entry: Partial<AuditLog> & Pick<AuditLog, 'orgId' | 'action' | 'entityType'>) {
    return this.repo.save(this.repo.create(entry));
  }

  async list(orgId: string, q: PaginationDto & { entityType?: string; entityId?: string }) {
    const qb = this.repo.createQueryBuilder('a')
      .where('a.org_id = :orgId', { orgId })
      .orderBy('a.created_at', 'DESC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.entityType) qb.andWhere('a.entity_type = :e', { e: q.entityType });
    if (q.entityId) qb.andWhere('a.entity_id = :eid', { eid: q.entityId });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }
}
