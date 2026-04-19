import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Marcador } from './entities/marcador.entity';
import { CreateMarcadorDto, UpdateMarcadorDto } from './dto/marcador.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class MarcadoresService {
  constructor(@InjectRepository(Marcador) private readonly repo: Repository<Marcador>) {}
  async list(orgId: string, q: PaginationDto) {
    const qb = this.repo.createQueryBuilder('m')
      .where('m.org_id = :orgId AND m.deleted_at IS NULL', { orgId })
      .orderBy('m.descricao', 'ASC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.search) qb.andWhere('m.descricao ILIKE :s', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }
  async get(orgId: string, id: string) {
    const m = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!m) throw new NotFoundException('Marcador not found'); return m;
  }
  create(orgId: string, dto: CreateMarcadorDto) {
    return this.repo.save(this.repo.create({ descricao: dto.nome, cor: dto.cor, orgId }));
  }
  async update(orgId: string, id: string, dto: UpdateMarcadorDto) {
    const m = await this.get(orgId, id);
    if (dto.nome !== undefined) m.descricao = dto.nome;
    if (dto.cor !== undefined) m.cor = dto.cor;
    return this.repo.save(m);
  }
  async remove(orgId: string, id: string) {
    const m = await this.get(orgId, id); await this.repo.softRemove(m); return { id, deleted: true };
  }
}
