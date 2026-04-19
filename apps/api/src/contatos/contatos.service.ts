import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Contato } from './entities/contato.entity';
import { CreateContatoDto, UpdateContatoDto } from './dto/contato.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class ContatosService {
  constructor(@InjectRepository(Contato) private readonly repo: Repository<Contato>) {}

  async list(orgId: string, q: PaginationDto & { tipo?: string }) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.org_id = :orgId AND c.deleted_at IS NULL', { orgId })
      .orderBy('c.nome', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.tipo) qb.andWhere(':tipo = ANY(c.tipos)', { tipo: q.tipo });
    if (q.search) {
      qb.andWhere(
        '(c.nome ILIKE :s OR c.nome_fantasia ILIKE :s OR c.cpf_cnpj ILIKE :s OR c.email ILIKE :s)',
        { s: `%${q.search}%` },
      );
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async get(orgId: string, id: string) {
    const c = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Contato not found');
    return c;
  }

  create(orgId: string, dto: CreateContatoDto) {
    const entity = this.repo.create({
      orgId,
      nome: dto.nome,
      nomeFantasia: dto.nomeFantasia,
      tipoPessoa: dto.tipoPessoa ?? 'pf',
      tipos: dto.tipos ?? [dto.tipo ?? 'cliente'],
      cpfCnpj: dto.cpfCnpj,
      email: dto.email,
      telefone: dto.telefone,
    });
    return this.repo.save(entity);
  }

  async update(orgId: string, id: string, dto: UpdateContatoDto) {
    const c = await this.get(orgId, id);
    if (dto.nome !== undefined) c.nome = dto.nome;
    if (dto.nomeFantasia !== undefined) c.nomeFantasia = dto.nomeFantasia;
    if (dto.tipos !== undefined) c.tipos = dto.tipos;
    if (dto.tipo !== undefined) c.tipos = [dto.tipo];
    if (dto.cpfCnpj !== undefined) c.cpfCnpj = dto.cpfCnpj;
    if (dto.email !== undefined) c.email = dto.email;
    if (dto.telefone !== undefined) c.telefone = dto.telefone;
    return this.repo.save(c);
  }

  async remove(orgId: string, id: string) {
    const c = await this.get(orgId, id);
    await this.repo.softRemove(c);
    return { id, deleted: true };
  }
}
