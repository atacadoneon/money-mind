import { Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
    @Inject(forwardRef(() => BillingService)) private readonly billingService: BillingService,
  ) {}

  async list(q: PaginationDto) {
    const qb = this.repo
      .createQueryBuilder('o')
      .where('o.deleted_at IS NULL')
      .orderBy(`o.${q.order_by ?? 'created_at'}`, (q.order_dir ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.search) qb.andWhere('o.name ILIKE :s OR o.slug ILIKE :s', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async get(id: string) {
    const o = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!o) throw new NotFoundException('Organization not found');
    return o;
  }

  async create(dto: CreateOrganizationDto) {
    const org = await this.repo.save(this.repo.create(dto));

    // Automatically start 14-day trial for every new organization
    try {
      await this.billingService.initTrialForOrg(org.id);
    } catch (err) {
      // Non-critical: log but don't fail org creation
      this.logger.warn(`Failed to init trial for org ${org.id}: ${err}`);
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const o = await this.get(id);
    Object.assign(o, dto);
    return this.repo.save(o);
  }

  async remove(id: string) {
    const o = await this.get(id);
    await this.repo.softRemove(o);
    return { id, deleted: true };
  }
}
