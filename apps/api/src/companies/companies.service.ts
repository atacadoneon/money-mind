import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly repo: Repository<Company>,
  ) {}

  async list(orgId: string, q: PaginationDto) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.org_id = :orgId AND c.deleted_at IS NULL', { orgId })
      .orderBy('c.created_at', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.search) qb.andWhere('(c.name ILIKE :s OR c.nome_fantasia ILIKE :s OR c.cnpj ILIKE :s)', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async get(orgId: string, id: string) {
    const c = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }

  async create(orgId: string, dto: CreateCompanyDto) {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.repo.findOne({ where: { orgId, slug, deletedAt: IsNull() } })) {
      slug = `${baseSlug}-${suffix++}`;
    }
    const entity = this.repo.create({
      orgId,
      name: dto.name,
      tradeName: dto.tradeName,
      cnpj: dto.cnpj,
      ie: dto.ie,
      slug,
    });
    return this.repo.save(entity);
  }

  async update(orgId: string, id: string, dto: UpdateCompanyDto) {
    const c = await this.get(orgId, id);
    if (dto.name) {
      c.name = dto.name;
      // Regenera slug quando name muda
      const baseSlug = slugify(dto.name);
      let slug = baseSlug;
      let suffix = 1;
      while (true) {
        const existing = await this.repo.findOne({ where: { orgId, slug, deletedAt: IsNull() } });
        if (!existing || existing.id === id) break;
        slug = `${baseSlug}-${suffix++}`;
      }
      c.slug = slug;
    }
    if (dto.tradeName !== undefined) c.tradeName = dto.tradeName;
    if (dto.cnpj !== undefined) c.cnpj = dto.cnpj;
    if (dto.ie !== undefined) c.ie = dto.ie;
    return this.repo.save(c);
  }

  async remove(orgId: string, id: string) {
    const c = await this.get(orgId, id);
    await this.repo.softRemove(c);
    return { id, deleted: true };
  }
}
