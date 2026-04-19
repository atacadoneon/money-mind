import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import { AlcadaAprovacao } from './entities/alcada-aprovacao.entity';
import { AprovacaoPagamento, StatusAprovacao } from './entities/aprovacao-pagamento.entity';
import {
  AprovarDto, CreateAlcadaDto, ListAprovacoesQuery, RejeitarDto,
  SolicitarAprovacaoDto, UpdateAlcadaDto,
} from './dto/aprovacao-pagamentos.dto';
import { buildMeta } from '../common/dto/pagination.dto';

const ROLE_HIERARCHY: Record<string, number> = {
  analista: 1, supervisor: 2, admin: 3, owner: 4,
};

@Injectable()
export class AprovacaoPagamentosService {
  constructor(
    @InjectRepository(AlcadaAprovacao) private readonly alcadaRepo: Repository<AlcadaAprovacao>,
    @InjectRepository(AprovacaoPagamento) private readonly aprovacaoRepo: Repository<AprovacaoPagamento>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private baseAlcada(orgId: string) {
    return this.alcadaRepo.createQueryBuilder('a').where('a.org_id = :orgId AND a.deleted_at IS NULL', { orgId });
  }

  private baseAprovacao(orgId: string) {
    return this.aprovacaoRepo.createQueryBuilder('ap').where('ap.org_id = :orgId AND ap.deleted_at IS NULL', { orgId });
  }

  // ─── Alçadas CRUD ─────────────────────────────────────────────────────────

  async listAlcadas(orgId: string, companyId?: string) {
    const qb = this.baseAlcada(orgId).andWhere('a.is_active = true').orderBy('a.ordem', 'ASC');
    if (companyId) qb.andWhere('(a.company_id = :cid OR a.company_id IS NULL)', { cid: companyId });
    return { data: await qb.getMany() };
  }

  async createAlcada(orgId: string, dto: CreateAlcadaDto) {
    const entity = this.alcadaRepo.create({
      orgId,
      companyId: dto.companyId ?? null,
      nome: dto.nome,
      valorMinimo: String(dto.valorMinimo),
      valorMaximo: dto.valorMaximo != null ? String(dto.valorMaximo) : null,
      aprovadorRole: dto.aprovadorRole as AlcadaAprovacao['aprovadorRole'],
      isActive: dto.isActive ?? true,
      ordem: dto.ordem ?? 0,
    });
    return this.alcadaRepo.save(entity);
  }

  async updateAlcada(orgId: string, id: string, dto: UpdateAlcadaDto) {
    const a = await this.alcadaRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!a) throw new NotFoundException('Alçada não encontrada');
    if (dto.nome !== undefined) a.nome = dto.nome;
    if (dto.valorMinimo != null) a.valorMinimo = String(dto.valorMinimo);
    if (dto.valorMaximo !== undefined) a.valorMaximo = dto.valorMaximo != null ? String(dto.valorMaximo) : null;
    if (dto.aprovadorRole !== undefined) a.aprovadorRole = dto.aprovadorRole as AlcadaAprovacao['aprovadorRole'];
    if (dto.isActive !== undefined) a.isActive = dto.isActive;
    if (dto.ordem !== undefined) a.ordem = dto.ordem;
    return this.alcadaRepo.save(a);
  }

  async removeAlcada(orgId: string, id: string) {
    const a = await this.alcadaRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!a) throw new NotFoundException('Alçada não encontrada');
    await this.alcadaRepo.softRemove(a);
    return { id, deleted: true };
  }

  // ─── Aprovações ───────────────────────────────────────────────────────────

  async solicitar(orgId: string, userId: string, dto: SolicitarAprovacaoDto) {
    // Encontrar alçada compatível por valor
    const alcada = await this.alcadaRepo.createQueryBuilder('a')
      .where('a.org_id = :orgId AND a.is_active = true AND a.deleted_at IS NULL', { orgId })
      .andWhere('(a.company_id = :cid OR a.company_id IS NULL)', { cid: dto.companyId })
      .andWhere('a.valor_minimo <= :valor', { valor: dto.valor })
      .andWhere('(a.valor_maximo IS NULL OR a.valor_maximo >= :valor)', { valor: dto.valor })
      .orderBy('a.ordem', 'ASC')
      .getOne();

    // Verificar duplicata potencial
    const riscoDuplicata = await this.detectarDuplicata(orgId, dto.contaPagarId, dto.valor);

    const entity = this.aprovacaoRepo.create({
      orgId,
      companyId: dto.companyId,
      contaPagarId: dto.contaPagarId,
      alcadaId: alcada?.id ?? null,
      valor: String(dto.valor),
      status: 'pendente' as StatusAprovacao,
      solicitadoPor: userId,
      solicitadoEm: new Date(),
      dataAgendada: dto.dataAgendada ?? null,
      contaBancariaId: dto.contaBancariaId ?? null,
      meioPagamento: dto.meioPagamento ?? null,
      observacoes: dto.observacoes ?? null,
      riscoDuplicataScore: riscoDuplicata.score,
      duplicataDetectadaId: riscoDuplicata.duplicataId ?? null,
    });

    return this.aprovacaoRepo.save(entity);
  }

  async aprovar(orgId: string, id: string, userId: string, userRole: string, dto: AprovarDto) {
    const ap = await this.aprovacaoRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!ap) throw new NotFoundException('Aprovação não encontrada');
    if (ap.status !== 'pendente') throw new BadRequestException(`Aprovação já está ${ap.status}`);

    // Verificar alçada
    if (ap.alcadaId) {
      const alcada = await this.alcadaRepo.findOne({ where: { id: ap.alcadaId } });
      if (alcada) {
        const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
        const requiredLevel = ROLE_HIERARCHY[alcada.aprovadorRole] ?? 99;
        if (userLevel < requiredLevel) {
          throw new BadRequestException(
            `Nível insuficiente. Requer ${alcada.aprovadorRole}, você é ${userRole}`,
          );
        }
      }
    }

    ap.status = 'aprovada';
    ap.aprovadorId = userId;
    ap.aprovadoEm = new Date();
    if (dto.observacoes) ap.observacoes = dto.observacoes;

    return this.aprovacaoRepo.save(ap);
  }

  async rejeitar(orgId: string, id: string, userId: string, dto: RejeitarDto) {
    const ap = await this.aprovacaoRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!ap) throw new NotFoundException('Aprovação não encontrada');
    if (ap.status !== 'pendente') throw new BadRequestException(`Aprovação já está ${ap.status}`);

    ap.status = 'rejeitada';
    ap.aprovadorId = userId;
    ap.aprovadoEm = new Date();
    ap.motivoRejeicao = dto.motivoRejeicao;

    return this.aprovacaoRepo.save(ap);
  }

  async listAprovacoes(orgId: string, q: ListAprovacoesQuery) {
    const qb = this.baseAprovacao(orgId)
      .orderBy('ap.solicitado_em', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.companyId) qb.andWhere('ap.company_id = :cid', { cid: q.companyId });
    if (q.status) qb.andWhere('ap.status = :status', { status: q.status });
    if (q.solicitadoPor) qb.andWhere('ap.solicitado_por = :sol', { sol: q.solicitadoPor });
    if (q.aprovadorId) qb.andWhere('ap.aprovador_id = :apv', { apv: q.aprovadorId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async listarPendentes(orgId: string, companyId?: string) {
    const qb = this.baseAprovacao(orgId).andWhere('ap.status = :s', { s: 'pendente' });
    if (companyId) qb.andWhere('ap.company_id = :cid', { cid: companyId });
    qb.orderBy('CAST(ap.valor AS numeric)', 'DESC');
    return { data: await qb.getMany() };
  }

  async expirarVencidas(orgId: string) {
    const limite = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h
    const result = await this.aprovacaoRepo
      .createQueryBuilder()
      .update(AprovacaoPagamento)
      .set({ status: 'expirada' as StatusAprovacao })
      .where('org_id = :orgId AND status = :s AND solicitado_em < :limite', {
        orgId, s: 'pendente', limite,
      })
      .execute();
    return { expiradas: result.affected ?? 0 };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async detectarDuplicata(orgId: string, contaPagarId: string, valor: number) {
    try {
      const existing = await this.aprovacaoRepo.findOne({
        where: {
          orgId,
          contaPagarId,
          status: 'pendente' as StatusAprovacao,
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        return { score: 90, duplicataId: existing.contaPagarId };
      }

      // Check for similar value in last 7 days
      const similar = await this.dataSource.query(
        `SELECT id FROM aprovacoes_pagamento
         WHERE org_id = $1 AND ABS(CAST(valor AS numeric) - $2) < 0.01
         AND status = 'pendente' AND solicitado_em > NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [orgId, valor],
      );
      if (similar.length > 0) {
        return { score: 60, duplicataId: null };
      }

      return { score: 0, duplicataId: null };
    } catch {
      return { score: 0, duplicataId: null };
    }
  }
}
