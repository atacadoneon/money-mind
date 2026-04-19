import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ContaBancaria } from './entities/conta-bancaria.entity';
import { CreateContaBancariaDto, UpdateContaBancariaDto } from './dto/conta-bancaria.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class ContasBancariasService {
  constructor(@InjectRepository(ContaBancaria) private readonly repo: Repository<ContaBancaria>) {}

  async list(orgId: string, q: PaginationDto & { companyId?: string }) {
    const qb = this.repo.createQueryBuilder('cb')
      .where('cb.org_id = :orgId AND cb.deleted_at IS NULL', { orgId })
      .orderBy('cb.nome', 'ASC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.companyId) qb.andWhere('cb.company_id = :cid', { cid: q.companyId });
    if (q.search) qb.andWhere('cb.nome ILIKE :s', { s: `%${q.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }
  async get(orgId: string, id: string) {
    const cb = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!cb) throw new NotFoundException('Conta bancária not found');
    return cb;
  }
  create(orgId: string, dto: CreateContaBancariaDto) {
    const e = this.repo.create({
      orgId, companyId: dto.companyId, nome: dto.nome, tipo: dto.tipo,
      bancoCodigo: dto.bancoCodigo, bancoNome: dto.bancoNome,
      agencia: dto.agencia, contaNumero: dto.contaNumero,
      saldoInicial: String(dto.saldoInicial ?? 0), saldoAtual: String(dto.saldoInicial ?? 0),
    });
    return this.repo.save(e);
  }
  async update(orgId: string, id: string, dto: UpdateContaBancariaDto) {
    const cb = await this.get(orgId, id);
    if (dto.nome !== undefined) cb.nome = dto.nome;
    if (dto.tipo !== undefined) cb.tipo = dto.tipo;
    if (dto.bancoCodigo !== undefined) cb.bancoCodigo = dto.bancoCodigo;
    if (dto.bancoNome !== undefined) cb.bancoNome = dto.bancoNome;
    if (dto.agencia !== undefined) cb.agencia = dto.agencia;
    if (dto.contaNumero !== undefined) cb.contaNumero = dto.contaNumero;
    return this.repo.save(cb);
  }
  async remove(orgId: string, id: string) {
    const cb = await this.get(orgId, id); await this.repo.softRemove(cb); return { id, deleted: true };
  }
}
