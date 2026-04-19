import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FormaPagamento } from './entities/forma-pagamento.entity';
import { CreateFormaPagamentoDto, UpdateFormaPagamentoDto } from './dto/forma-pagamento.dto';
import { PaginationDto, buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class FormasPagamentoService {
  constructor(@InjectRepository(FormaPagamento) private readonly repo: Repository<FormaPagamento>) {}
  async list(orgId: string, q: PaginationDto) {
    const [data, total] = await this.repo.findAndCount({
      where: { orgId, deletedAt: IsNull() }, order: { nome: 'ASC' },
      skip: (q.page - 1) * q.limit, take: q.limit,
    });
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }
  async get(orgId: string, id: string) {
    const f = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!f) throw new NotFoundException('FormaPagamento not found'); return f;
  }
  create(orgId: string, dto: CreateFormaPagamentoDto) { return this.repo.save(this.repo.create({ ...dto, orgId })); }
  async update(orgId: string, id: string, dto: UpdateFormaPagamentoDto) {
    const f = await this.get(orgId, id); Object.assign(f, dto); return this.repo.save(f);
  }
  async remove(orgId: string, id: string) {
    const f = await this.get(orgId, id); await this.repo.softRemove(f); return { id, deleted: true };
  }
}
