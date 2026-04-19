import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Categoria } from './entities/categoria.entity';
import { CreateCategoriaDto, UpdateCategoriaDto } from './dto/categoria.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class CategoriasService {
  constructor(@InjectRepository(Categoria) private readonly repo: Repository<Categoria>) {}

  async list(orgId: string, q: PaginationDto & { tipo?: string }) {
    const qb = this.repo.createQueryBuilder('c')
      .where('c.org_id = :orgId AND c.deleted_at IS NULL', { orgId })
      .orderBy('c.nome', 'ASC')
      .skip((q.page - 1) * q.limit).take(q.limit);
    if (q.tipo) qb.andWhere('c.tipo = :tipo', { tipo: q.tipo });
    if (q.search) qb.andWhere('c.nome ILIKE :s', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async tree(orgId: string, tipo?: 'receita' | 'despesa') {
    const all = await this.repo.find({ where: { orgId, deletedAt: IsNull(), ...(tipo ? { tipo } : {}) } });
    const byParent = new Map<string | null, Categoria[]>();
    for (const c of all) {
      const k = c.parentId ?? null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(c);
    }
    const build = (pid: string | null): unknown[] =>
      (byParent.get(pid) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    return { data: build(null) };
  }

  async get(orgId: string, id: string) {
    const c = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Categoria not found');
    return c;
  }

  create(orgId: string, dto: CreateCategoriaDto) {
    return this.repo.save(this.repo.create({ ...dto, orgId }));
  }

  async update(orgId: string, id: string, dto: UpdateCategoriaDto) {
    const c = await this.get(orgId, id); Object.assign(c, dto); return this.repo.save(c);
  }

  async remove(orgId: string, id: string) {
    const c = await this.get(orgId, id); await this.repo.softRemove(c); return { id, deleted: true };
  }
}
