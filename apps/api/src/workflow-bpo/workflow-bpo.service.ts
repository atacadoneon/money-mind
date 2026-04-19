import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CarteiraAnalista } from './entities/carteira-analista.entity';
import { StatusTarefa, TarefaWorkflow } from './entities/tarefa-workflow.entity';
import {
  AtribuirTarefaDto, CreateCarteiraDto, CreateTarefaDto,
  ListTarefasQuery, MoverTarefaDto, UpdateCarteiraDto, UpdateTarefaDto,
} from './dto/workflow-bpo.dto';
import { buildMeta } from '../common/dto/pagination.dto';

/** Transicoes validas de status */
const TRANSICOES: Record<string, string[]> = {
  backlog: ['a_fazer', 'cancelada'],
  a_fazer: ['em_andamento', 'cancelada'],
  em_andamento: ['revisao', 'concluida', 'cancelada'],
  revisao: ['em_andamento', 'concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
};

@Injectable()
export class WorkflowBpoService {
  constructor(
    @InjectRepository(CarteiraAnalista) private readonly carteiraRepo: Repository<CarteiraAnalista>,
    @InjectRepository(TarefaWorkflow) private readonly tarefaRepo: Repository<TarefaWorkflow>,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private baseCarteira(orgId: string) {
    return this.carteiraRepo.createQueryBuilder('c')
      .where('c.org_id = :orgId AND c.deleted_at IS NULL', { orgId });
  }

  private baseTarefa(orgId: string) {
    return this.tarefaRepo.createQueryBuilder('t')
      .where('t.org_id = :orgId AND t.deleted_at IS NULL', { orgId });
  }

  // ─── CARTEIRA CRUD ─────────────────────────────────────────────────────────

  async listCarteiras(orgId: string) {
    const data = await this.baseCarteira(orgId)
      .andWhere('c.is_active = true')
      .orderBy('c.created_at', 'DESC')
      .getMany();
    return { data };
  }

  async getCarteira(orgId: string, id: string) {
    const c = await this.carteiraRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Carteira nao encontrada');
    return c;
  }

  async createCarteira(orgId: string, dto: CreateCarteiraDto) {
    const existing = await this.carteiraRepo.findOne({
      where: { orgId, analistaId: dto.analistaId, companyId: dto.companyId, deletedAt: IsNull() },
    });
    if (existing) throw new BadRequestException('Analista ja possui esta empresa na carteira');

    const entity = this.carteiraRepo.create({
      orgId,
      analistaId: dto.analistaId,
      companyId: dto.companyId,
      isActive: dto.isActive ?? true,
      slaFechamentoDia: dto.slaFechamentoDia ?? 10,
      slaConciliacao: dto.slaConciliacao ?? 'diaria',
      slaCobranca: dto.slaCobranca ?? 'semanal',
    });
    return this.carteiraRepo.save(entity);
  }

  async updateCarteira(orgId: string, id: string, dto: UpdateCarteiraDto) {
    const c = await this.getCarteira(orgId, id);
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    if (dto.slaFechamentoDia !== undefined) c.slaFechamentoDia = dto.slaFechamentoDia;
    if (dto.slaConciliacao !== undefined) c.slaConciliacao = dto.slaConciliacao;
    if (dto.slaCobranca !== undefined) c.slaCobranca = dto.slaCobranca;
    return this.carteiraRepo.save(c);
  }

  async removeCarteira(orgId: string, id: string) {
    const c = await this.getCarteira(orgId, id);
    await this.carteiraRepo.softRemove(c);
    return { id, deleted: true };
  }

  async listEmpresasAnalista(orgId: string, analistaId: string) {
    const data = await this.baseCarteira(orgId)
      .andWhere('c.analista_id = :analistaId AND c.is_active = true', { analistaId })
      .getMany();
    return { data };
  }

  // ─── TAREFA CRUD ───────────────────────────────────────────────────────────

  async listTarefas(orgId: string, q: ListTarefasQuery) {
    const qb = this.baseTarefa(orgId)
      .orderBy('t.prazo', 'ASC', 'NULLS LAST')
      .addOrderBy('t.created_at', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.status) qb.andWhere('t.status = :status', { status: q.status });
    if (q.tipo) qb.andWhere('t.tipo = :tipo', { tipo: q.tipo });
    if (q.analistaId) qb.andWhere('t.analista_id = :analistaId', { analistaId: q.analistaId });
    if (q.companyId) qb.andWhere('t.company_id = :companyId', { companyId: q.companyId });
    if (q.search) {
      qb.andWhere('(t.titulo ILIKE :s OR t.descricao ILIKE :s)', { s: `%${q.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getTarefa(orgId: string, id: string) {
    const t = await this.tarefaRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException('Tarefa nao encontrada');
    return t;
  }

  async createTarefa(orgId: string, dto: CreateTarefaDto) {
    const entity = this.tarefaRepo.create({
      orgId,
      companyId: dto.companyId,
      titulo: dto.titulo,
      descricao: dto.descricao,
      tipo: dto.tipo as TarefaWorkflow['tipo'],
      prioridade: (dto.prioridade ?? 'media') as TarefaWorkflow['prioridade'],
      status: 'backlog',
      analistaId: dto.analistaId ?? null,
      supervisorId: dto.supervisorId ?? null,
      prazo: dto.prazo ? new Date(dto.prazo) : null,
      entidadeTipo: dto.entidadeTipo ?? null,
      entidadeId: dto.entidadeId ?? null,
    });
    return this.tarefaRepo.save(entity);
  }

  async updateTarefa(orgId: string, id: string, dto: UpdateTarefaDto) {
    const t = await this.getTarefa(orgId, id);
    if (dto.titulo !== undefined) t.titulo = dto.titulo;
    if (dto.descricao !== undefined) t.descricao = dto.descricao;
    if (dto.tipo !== undefined) t.tipo = dto.tipo as TarefaWorkflow['tipo'];
    if (dto.prioridade !== undefined) t.prioridade = dto.prioridade as TarefaWorkflow['prioridade'];
    if (dto.analistaId !== undefined) t.analistaId = dto.analistaId;
    if (dto.supervisorId !== undefined) t.supervisorId = dto.supervisorId;
    if (dto.prazo !== undefined) t.prazo = dto.prazo ? new Date(dto.prazo) : null;
    if (dto.tempoGastoMin !== undefined) t.tempoGastoMin = dto.tempoGastoMin;
    return this.tarefaRepo.save(t);
  }

  async removeTarefa(orgId: string, id: string) {
    const t = await this.getTarefa(orgId, id);
    await this.tarefaRepo.softRemove(t);
    return { id, deleted: true };
  }

  // ─── MOVER STATUS ──────────────────────────────────────────────────────────

  async moverTarefa(orgId: string, id: string, dto: MoverTarefaDto) {
    const t = await this.getTarefa(orgId, id);
    const novoStatus = dto.status as StatusTarefa;
    const permitidos = TRANSICOES[t.status];

    if (!permitidos || !permitidos.includes(novoStatus)) {
      throw new BadRequestException(
        `Transicao invalida: ${t.status} -> ${novoStatus}. Permitidos: ${(permitidos ?? []).join(', ') || 'nenhuma'}`,
      );
    }

    t.status = novoStatus;

    if (novoStatus === 'em_andamento' && !t.metadata?.iniciadoEm) {
      t.metadata = { ...t.metadata, iniciadoEm: new Date().toISOString() };
    }
    if (novoStatus === 'concluida') {
      t.concluidaEm = new Date();
    }
    if (dto.observacoes) {
      t.comentarioRevisao = dto.observacoes;
    }

    return this.tarefaRepo.save(t);
  }

  // ─── ATRIBUIR ──────────────────────────────────────────────────────────────

  async atribuirTarefa(orgId: string, id: string, dto: AtribuirTarefaDto) {
    const t = await this.getTarefa(orgId, id);

    // Valida se o analista tem a empresa na carteira
    const carteira = await this.carteiraRepo.findOne({
      where: {
        orgId,
        analistaId: dto.analistaId,
        companyId: t.companyId,
        isActive: true,
        deletedAt: IsNull(),
      },
    });
    if (!carteira) {
      throw new BadRequestException('Analista nao possui esta empresa na carteira');
    }

    t.analistaId = dto.analistaId;
    return this.tarefaRepo.save(t);
  }

  // ─── FILA DE TRABALHO ──────────────────────────────────────────────────────

  async filaTrabalho(orgId: string, analistaId?: string) {
    const qb = this.baseTarefa(orgId)
      .andWhere('t.status NOT IN (:...finais)', { finais: ['concluida', 'cancelada'] });

    if (analistaId) {
      qb.andWhere('t.analista_id = :analistaId', { analistaId });
    }

    // Atrasadas primeiro, depois por prioridade (critica > alta > media > baixa), depois por prazo
    qb.addSelect(
      `CASE WHEN t.prazo IS NOT NULL AND t.prazo < NOW() THEN 0 ELSE 1 END`,
      't_overdue_rank',
    );
    qb.addSelect(
      `CASE t.prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 ELSE 4 END`,
      't_prio_rank',
    );

    qb.orderBy('t_overdue_rank', 'ASC')
      .addOrderBy('t_prio_rank', 'ASC')
      .addOrderBy('t.prazo', 'ASC', 'NULLS LAST');

    const data = await qb.getMany();
    return { data };
  }

  // ─── METRICAS ──────────────────────────────────────────────────────────────

  async metricas(orgId: string, companyId?: string) {
    const qb = this.baseTarefa(orgId)
      .andWhere('t.analista_id IS NOT NULL');

    if (companyId) qb.andWhere('t.company_id = :companyId', { companyId });

    const rows = await qb
      .select('t.analista_id', 'analistaId')
      .addSelect('COUNT(*) FILTER (WHERE t.status = \'concluida\')', 'concluidas')
      .addSelect('COUNT(*) FILTER (WHERE t.status NOT IN (\'concluida\', \'cancelada\'))', 'pendentes')
      .addSelect('AVG(t.tempo_gasto_min) FILTER (WHERE t.status = \'concluida\')', 'tempoMedioMin')
      .addSelect(
        'COUNT(*) FILTER (WHERE t.status = \'em_andamento\' AND t.comentario_revisao IS NOT NULL)',
        'retrabalho',
      )
      .groupBy('t.analista_id')
      .getRawMany<{
        analistaId: string;
        concluidas: string;
        pendentes: string;
        tempoMedioMin: string | null;
        retrabalho: string;
      }>();

    const data = rows.map((r) => ({
      analistaId: r.analistaId,
      concluidas: Number(r.concluidas),
      pendentes: Number(r.pendentes),
      tempoMedioMin: r.tempoMedioMin ? Math.round(Number(r.tempoMedioMin)) : 0,
      taxaRetrabalho: Number(r.concluidas) > 0
        ? Math.round((Number(r.retrabalho) / Number(r.concluidas)) * 100)
        : 0,
    }));

    return { data };
  }
}
