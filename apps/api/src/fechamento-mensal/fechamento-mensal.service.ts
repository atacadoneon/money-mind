import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { FechamentoMensal, StatusFechamento } from './entities/fechamento-mensal.entity';
import { FechamentoChecklistItem, CategoriaChecklist, StatusChecklist, TipoChecklist } from './entities/fechamento-checklist-item.entity';
import {
  AprovarFechamentoDto, CreateChecklistItemDto, CreateFechamentoDto,
  ListFechamentosQuery, ReabrirFechamentoDto, UpdateChecklistItemDto, UpdateFechamentoDto,
} from './dto/fechamento-mensal.dto';
import { buildMeta } from '../common/dto/pagination.dto';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

interface DefaultChecklistItem {
  titulo: string;
  descricao: string;
  tipo: TipoChecklist;
  categoria: CategoriaChecklist;
  isBloqueante: boolean;
}

const DEFAULT_CHECKLIST: DefaultChecklistItem[] = [
  {
    titulo: 'Conciliações bancárias pendentes',
    descricao: 'Verificar se todas as contas bancárias estão conciliadas no período',
    tipo: 'automatico',
    categoria: 'bancario',
    isBloqueante: true,
  },
  {
    titulo: 'Contas a pagar sem categoria',
    descricao: 'Verificar se existem contas a pagar sem categoria atribuída',
    tipo: 'automatico',
    categoria: 'categoria',
    isBloqueante: true,
  },
  {
    titulo: 'Contas a receber sem categoria',
    descricao: 'Verificar se existem contas a receber sem categoria atribuída',
    tipo: 'automatico',
    categoria: 'categoria',
    isBloqueante: true,
  },
  {
    titulo: 'Divergência de saldos bancários',
    descricao: 'Verificar se o saldo calculado bate com o saldo do extrato',
    tipo: 'manual',
    categoria: 'bancario',
    isBloqueante: false,
  },
  {
    titulo: 'Contas a pagar em aberto no período',
    descricao: 'Verificar se há contas vencidas não pagas no período',
    tipo: 'automatico',
    categoria: 'geral',
    isBloqueante: false,
  },
  {
    titulo: 'Contas a receber em aberto no período',
    descricao: 'Verificar se há contas a receber pendentes no período',
    tipo: 'automatico',
    categoria: 'geral',
    isBloqueante: false,
  },
  {
    titulo: 'Lançamentos sem documento fiscal',
    descricao: 'Verificar se há lançamentos sem número de documento vinculado',
    tipo: 'manual',
    categoria: 'documento',
    isBloqueante: false,
  },
  {
    titulo: 'Revisão de DRE do período',
    descricao: 'Conferir demonstrativo de resultado do exercício do mês',
    tipo: 'manual',
    categoria: 'geral',
    isBloqueante: false,
  },
];

@Injectable()
export class FechamentoMensalService {
  constructor(
    @InjectRepository(FechamentoMensal) private readonly repo: Repository<FechamentoMensal>,
    @InjectRepository(FechamentoChecklistItem) private readonly checklistRepo: Repository<FechamentoChecklistItem>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private baseQb(orgId: string) {
    return this.repo.createQueryBuilder('fm').where('fm.org_id = :orgId AND fm.deleted_at IS NULL', { orgId });
  }

  private checklistQb(orgId: string) {
    return this.checklistRepo.createQueryBuilder('ci').where('ci.org_id = :orgId', { orgId });
  }

  /** Parse competencia "2026-04" into {ano, mes} */
  private parseCompetencia(competencia: string): { ano: number; mes: number } {
    const [ano, mes] = competencia.split('-').map(Number);
    return { ano, mes };
  }

  // ─── List ──────────────────────────────────────────────────────────────────────

  async list(orgId: string, q: ListFechamentosQuery) {
    const qb = this.baseQb(orgId)
      .orderBy(`fm.${q.order_by ?? 'created_at'}`, (q.order_dir ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.companyId) qb.andWhere('fm.company_id = :cid', { cid: q.companyId });
    if (q.competencia) qb.andWhere('fm.competencia = :comp', { comp: q.competencia });
    if (q.status) qb.andWhere('fm.status = :status', { status: q.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  // ─── Get ───────────────────────────────────────────────────────────────────────

  async get(orgId: string, id: string) {
    const fm = await this.repo.findOne({
      where: { id, orgId, deletedAt: IsNull() },
      relations: ['checklistItens'],
    });
    if (!fm) throw new NotFoundException('Fechamento mensal não encontrado');
    return fm;
  }

  // ─── Create ────────────────────────────────────────────────────────────────────

  async create(orgId: string, dto: CreateFechamentoDto) {
    const existing = await this.repo.findOne({
      where: {
        orgId,
        companyId: dto.companyId,
        competencia: dto.competencia,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      throw new BadRequestException(`Já existe fechamento para ${dto.competencia} nesta empresa`);
    }

    let fechamento!: FechamentoMensal;

    await this.dataSource.transaction(async (em) => {
      fechamento = em.getRepository(FechamentoMensal).create({
        orgId,
        companyId: dto.companyId,
        competencia: dto.competencia,
        status: 'aberto' as StatusFechamento,
        analistaId: dto.analistaId ?? null,
        observacoes: dto.observacoes ?? null,
      });
      fechamento = await em.save(FechamentoMensal, fechamento);

      // Criar checklist padrao
      const itens = DEFAULT_CHECKLIST.map((item, idx) =>
        em.getRepository(FechamentoChecklistItem).create({
          orgId,
          fechamentoId: fechamento.id,
          titulo: item.titulo,
          descricao: item.descricao,
          tipo: item.tipo,
          categoria: item.categoria,
          isBloqueante: item.isBloqueante,
          status: 'pendente' as StatusChecklist,
          metadata: {},
        }),
      );
      await em.save(FechamentoChecklistItem, itens);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'create',
        entityType: 'fechamento_mensal',
        entityId: fechamento.id,
        changes: { after: { competencia: dto.competencia, companyId: dto.companyId } },
        metadata: {},
      }));
    });

    return this.get(orgId, fechamento.id);
  }

  // ─── Update ────────────────────────────────────────────────────────────────────

  async update(orgId: string, id: string, dto: UpdateFechamentoDto) {
    const fm = await this.get(orgId, id);
    if (fm.status === 'fechado') {
      throw new BadRequestException('Fechamento já encerrado. Reabra antes de editar.');
    }
    if (dto.observacoes !== undefined) fm.observacoes = dto.observacoes;
    if (dto.analistaId !== undefined) fm.analistaId = dto.analistaId ?? null;
    return this.repo.save(fm);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────────

  async remove(orgId: string, id: string) {
    const fm = await this.get(orgId, id);
    if (fm.status === 'fechado' || fm.status === 'aprovado') {
      throw new BadRequestException('Não é possível excluir fechamento aprovado/fechado');
    }
    await this.repo.softRemove(fm);
    return { id, deleted: true };
  }

  // ─── Workflow: Iniciar ─────────────────────────────────────────────────────────

  async iniciar(orgId: string, id: string, userId: string) {
    const fm = await this.get(orgId, id);
    this.assertTransition(fm.status, ['aberto', 'reaberto'], 'em_progresso');

    await this.dataSource.transaction(async (em) => {
      fm.status = 'em_progresso';
      fm.analistaId = userId;
      await em.save(FechamentoMensal, fm);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'iniciar',
        entityType: 'fechamento_mensal',
        entityId: id,
        changes: { before: { status: 'aberto' }, after: { status: 'em_progresso' } },
        metadata: { userId },
      }));
    });

    return fm;
  }

  // ─── Workflow: Enviar para revisao ─────────────────────────────────────────────

  async enviarRevisao(orgId: string, id: string, userId: string) {
    const fm = await this.get(orgId, id);
    this.assertTransition(fm.status, ['em_progresso'], 'revisao');

    await this.dataSource.transaction(async (em) => {
      fm.status = 'revisao';
      await em.save(FechamentoMensal, fm);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'enviar_revisao',
        entityType: 'fechamento_mensal',
        entityId: id,
        changes: { before: { status: 'em_progresso' }, after: { status: 'revisao' } },
        metadata: { userId },
      }));
    });

    return fm;
  }

  // ─── Workflow: Aprovar ─────────────────────────────────────────────────────────

  async aprovar(orgId: string, id: string, userId: string, dto: AprovarFechamentoDto) {
    const fm = await this.get(orgId, id);
    this.assertTransition(fm.status, ['revisao'], 'aprovado');

    await this.dataSource.transaction(async (em) => {
      fm.status = 'aprovado';
      fm.aprovadoPor = userId;
      fm.aprovadoEm = new Date();
      if (dto.observacoes) fm.observacoes = dto.observacoes;
      await em.save(FechamentoMensal, fm);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'aprovar',
        entityType: 'fechamento_mensal',
        entityId: id,
        changes: { before: { status: 'revisao' }, after: { status: 'aprovado' } },
        metadata: { userId },
      }));
    });

    return fm;
  }

  // ─── Workflow: Fechar ──────────────────────────────────────────────────────────

  async fechar(orgId: string, id: string, userId: string) {
    const fm = await this.get(orgId, id);
    this.assertTransition(fm.status, ['aprovado'], 'fechado');

    // Verificar bloqueantes
    const itens = await this.checklistRepo.find({
      where: { fechamentoId: id, orgId },
    });
    const bloqueantes = itens.filter((i) => i.isBloqueante && i.status !== 'ok' && i.status !== 'ignorado');
    if (bloqueantes.length > 0) {
      const titles = bloqueantes.map((i) => i.titulo).join(', ');
      throw new BadRequestException(
        `Não é possível fechar: ${bloqueantes.length} pendência(s) bloqueante(s): ${titles}`,
      );
    }

    await this.dataSource.transaction(async (em) => {
      fm.status = 'fechado';
      fm.fechadoPor = userId;
      fm.fechadoEm = new Date();

      // Calcular progresso
      const total = itens.length;
      const resolvidos = itens.filter((i) => i.status === 'ok' || i.status === 'ignorado').length;
      fm.progressoPercentual = total > 0 ? Math.round((resolvidos / total) * 100) : 100;
      fm.totalPendencias = itens.filter((i) => i.status === 'pendente' || i.status === 'bloqueante').length;
      fm.pendenciasBloqueantes = itens.filter((i) => i.status === 'bloqueante').length;

      await em.save(FechamentoMensal, fm);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'fechar',
        entityType: 'fechamento_mensal',
        entityId: id,
        changes: { before: { status: 'aprovado' }, after: { status: 'fechado' } },
        metadata: { userId },
      }));
    });

    return fm;
  }

  // ─── Workflow: Reabrir ─────────────────────────────────────────────────────────

  async reabrir(orgId: string, id: string, userId: string, dto: ReabrirFechamentoDto) {
    const fm = await this.get(orgId, id);
    this.assertTransition(fm.status, ['fechado', 'aprovado'], 'reaberto');

    const previousStatus = fm.status;

    await this.dataSource.transaction(async (em) => {
      fm.status = 'reaberto';
      fm.motivoReabertura = dto.motivoReabertura;
      fm.reabertoPor = userId;
      fm.reabertoEm = new Date();
      fm.fechadoEm = null;
      fm.fechadoPor = null;
      fm.aprovadoEm = null;
      fm.aprovadoPor = null;
      await em.save(FechamentoMensal, fm);

      await em.save(AuditLog, this.auditRepo.create({
        orgId,
        action: 'reabrir',
        entityType: 'fechamento_mensal',
        entityId: id,
        changes: {
          before: { status: previousStatus },
          after: { status: 'reaberto', motivoReabertura: dto.motivoReabertura },
        },
        metadata: { userId, motivo: dto.motivoReabertura },
      }));
    });

    return fm;
  }

  // ─── Checklist ─────────────────────────────────────────────────────────────────

  async getChecklist(orgId: string, fechamentoId: string) {
    await this.get(orgId, fechamentoId);

    const itens = await this.checklistQb(orgId)
      .andWhere('ci.fechamento_id = :fid', { fid: fechamentoId })
      .orderBy('ci.created_at', 'ASC')
      .getMany();

    return { data: itens };
  }

  async addChecklistItem(orgId: string, fechamentoId: string, dto: CreateChecklistItemDto) {
    const fm = await this.get(orgId, fechamentoId);
    if (fm.status === 'fechado') {
      throw new BadRequestException('Não é possível adicionar itens a um fechamento encerrado');
    }

    const item = this.checklistRepo.create({
      orgId,
      fechamentoId,
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      tipo: (dto.tipo ?? 'manual') as TipoChecklist,
      categoria: (dto.categoria ?? 'geral') as CategoriaChecklist,
      atribuidoA: dto.atribuidoA ?? null,
      status: 'pendente',
      metadata: {},
    });

    return this.checklistRepo.save(item);
  }

  async updateChecklistItem(orgId: string, itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.checklistRepo.findOne({
      where: { id: itemId, orgId },
    });
    if (!item) throw new NotFoundException('Item do checklist não encontrado');

    const fm = await this.repo.findOne({
      where: { id: item.fechamentoId, orgId, deletedAt: IsNull() },
    });
    if (fm?.status === 'fechado') {
      throw new BadRequestException('Não é possível alterar itens de um fechamento encerrado');
    }

    if (dto.status !== undefined) {
      item.status = dto.status;
      if (dto.status === 'ok' || dto.status === 'ignorado') {
        item.resolvidoEm = new Date();
      } else {
        item.resolvidoEm = null;
      }
    }
    if (dto.atribuidoA !== undefined) item.atribuidoA = dto.atribuidoA ?? null;

    return this.checklistRepo.save(item);
  }

  async removeChecklistItem(orgId: string, itemId: string) {
    const item = await this.checklistRepo.findOne({
      where: { id: itemId, orgId },
    });
    if (!item) throw new NotFoundException('Item do checklist não encontrado');

    // checklist_itens nao tem deleted_at na migration, usar hard delete
    await this.checklistRepo.remove(item);
    return { id: itemId, deleted: true };
  }

  // ─── Auto Checks ──────────────────────────────────────────────────────────────

  async runAutoChecks(orgId: string, fechamentoId: string) {
    const fm = await this.get(orgId, fechamentoId);
    const { ano, mes } = this.parseCompetencia(fm.competencia);

    const itens = await this.checklistRepo.find({
      where: {
        fechamentoId,
        orgId,
        tipo: 'automatico',
      },
    });

    const results: Array<{ id: string; titulo: string; status: StatusChecklist; resultado: Record<string, unknown> }> = [];

    for (const item of itens) {
      try {
        // Run auto-check queries based on categoria
        let row: Record<string, unknown> = {};

        if (item.categoria === 'bancario') {
          const [r] = await this.dataSource.query(
            `SELECT COUNT(*) as pendentes FROM extratos_bancarios WHERE org_id = $1 AND company_id = $2
             AND EXTRACT(YEAR FROM data) = $3 AND EXTRACT(MONTH FROM data) = $4
             AND reconciled = false AND deleted_at IS NULL`,
            [orgId, fm.companyId, ano, mes],
          );
          row = r ?? {};
        } else if (item.categoria === 'categoria' && item.titulo.includes('pagar')) {
          const [r] = await this.dataSource.query(
            `SELECT COUNT(*) as sem_categoria FROM contas_pagar WHERE org_id = $1 AND company_id = $2
             AND EXTRACT(YEAR FROM data_vencimento) = $3 AND EXTRACT(MONTH FROM data_vencimento) = $4
             AND categoria_id IS NULL AND deleted_at IS NULL`,
            [orgId, fm.companyId, ano, mes],
          );
          row = r ?? {};
        } else if (item.categoria === 'categoria' && item.titulo.includes('receber')) {
          const [r] = await this.dataSource.query(
            `SELECT COUNT(*) as sem_categoria FROM contas_receber WHERE org_id = $1 AND company_id = $2
             AND EXTRACT(YEAR FROM data_vencimento) = $3 AND EXTRACT(MONTH FROM data_vencimento) = $4
             AND categoria_id IS NULL AND deleted_at IS NULL`,
            [orgId, fm.companyId, ano, mes],
          );
          row = r ?? {};
        } else {
          // Generic check
          row = {};
        }

        const values = Object.values(row).map(Number);
        const hasIssues = values.some((v) => !isNaN(v) && v > 0);

        item.status = hasIssues ? (item.isBloqueante ? 'bloqueante' : 'pendente') : 'ok';
        item.resolvidoEm = item.status === 'ok' ? new Date() : null;
        item.metadata = { ...item.metadata, autoCheck: row, checkedAt: new Date().toISOString() };

        await this.checklistRepo.save(item);

        results.push({ id: item.id, titulo: item.titulo, status: item.status, resultado: row });
      } catch (err) {
        item.status = item.isBloqueante ? 'bloqueante' : 'pendente';
        item.metadata = { ...item.metadata, error: (err as Error).message };
        await this.checklistRepo.save(item);

        results.push({ id: item.id, titulo: item.titulo, status: item.status, resultado: { error: (err as Error).message } });
      }
    }

    // Update fechamento progress
    const allItens = await this.checklistRepo.find({ where: { fechamentoId, orgId } });
    const total = allItens.length;
    const resolvidos = allItens.filter((i) => i.status === 'ok' || i.status === 'ignorado').length;
    fm.progressoPercentual = total > 0 ? Math.round((resolvidos / total) * 100) : 0;
    fm.totalPendencias = allItens.filter((i) => i.status === 'pendente' || i.status === 'bloqueante').length;
    fm.pendenciasBloqueantes = allItens.filter((i) => i.status === 'bloqueante').length;
    await this.repo.save(fm);

    return {
      data: results,
      total: results.length,
      ok: results.filter((r) => r.status === 'ok').length,
      pendentes: results.filter((r) => r.status !== 'ok').length,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────────

  private assertTransition(current: StatusFechamento, allowed: StatusFechamento[], target: StatusFechamento) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Transição inválida: não é possível ir de "${current}" para "${target}". Status permitidos: ${allowed.join(', ')}`,
      );
    }
  }
}
