import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CobrancaCadencia, EtapaCadencia } from './entities/cobranca-cadencia.entity';
import { CobrancaExecucao } from './entities/cobranca-execucao.entity';
import { CobrancaAcao } from './entities/cobranca-acao.entity';
import { CobrancaTemplate } from './entities/cobranca-template.entity';
import {
  CreateCadenciaDto, CreateTemplateDto, IniciarCobrancaDto, ListExecucoesQuery,
  ListTemplatesQuery, PausarCobrancaDto, UpdateCadenciaDto, UpdateTemplateDto,
} from './dto/cobranca-automatizada.dto';
import { buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class CobrancaAutomatizadaService {
  constructor(
    @InjectRepository(CobrancaCadencia) private readonly cadenciaRepo: Repository<CobrancaCadencia>,
    @InjectRepository(CobrancaExecucao) private readonly execucaoRepo: Repository<CobrancaExecucao>,
    @InjectRepository(CobrancaAcao) private readonly acaoRepo: Repository<CobrancaAcao>,
    @InjectRepository(CobrancaTemplate) private readonly templateRepo: Repository<CobrancaTemplate>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Cadencias CRUD ───────────────────────────────────────────────────────

  async listCadencias(orgId: string) {
    const data = await this.cadenciaRepo.find({
      where: { orgId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return { data };
  }

  async getCadencia(orgId: string, id: string) {
    const c = await this.cadenciaRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Cadência não encontrada');
    return c;
  }

  async createCadencia(orgId: string, dto: CreateCadenciaDto) {
    const entity = this.cadenciaRepo.create({
      orgId,
      companyId: dto.companyId ?? null,
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      segmentoAlvo: dto.segmentoAlvo ?? 'todos',
      etapas: (dto.etapas ?? []) as unknown as EtapaCadencia[],
    });
    return this.cadenciaRepo.save(entity);
  }

  async updateCadencia(orgId: string, id: string, dto: UpdateCadenciaDto) {
    const c = await this.getCadencia(orgId, id);
    if (dto.nome !== undefined) c.nome = dto.nome;
    if (dto.descricao !== undefined) c.descricao = dto.descricao;
    if (dto.segmentoAlvo !== undefined) c.segmentoAlvo = dto.segmentoAlvo;
    if (dto.etapas !== undefined) c.etapas = dto.etapas as unknown as EtapaCadencia[];
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.cadenciaRepo.save(c);
  }

  async removeCadencia(orgId: string, id: string) {
    const c = await this.getCadencia(orgId, id);
    await this.cadenciaRepo.softRemove(c);
    return { id, deleted: true };
  }

  // ─── Templates CRUD ───────────────────────────────────────────────────────

  async listTemplates(orgId: string, q: ListTemplatesQuery) {
    const qb = this.templateRepo.createQueryBuilder('t')
      .where('t.org_id = :orgId AND t.deleted_at IS NULL', { orgId })
      .orderBy('t.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.canal) qb.andWhere('t.canal = :canal', { canal: q.canal });
    if (q.nivelEscalacao) qb.andWhere('t.nivel_escalacao = :nivel', { nivel: q.nivelEscalacao });
    if (q.isActive !== undefined) qb.andWhere('t.is_active = :active', { active: q.isActive });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async createTemplate(orgId: string, dto: CreateTemplateDto) {
    const entity = this.templateRepo.create({
      orgId,
      nome: dto.nome,
      canal: dto.canal,
      assunto: dto.assunto ?? null,
      conteudo: dto.conteudo,
      nivelEscalacao: (dto.nivelEscalacao ?? 'L0') as CobrancaTemplate['nivelEscalacao'],
      variaveis: dto.variaveis ?? [],
      isActive: true,
    });
    return this.templateRepo.save(entity);
  }

  async updateTemplate(orgId: string, id: string, dto: UpdateTemplateDto) {
    const t = await this.templateRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException('Template não encontrado');
    if (dto.nome !== undefined) t.nome = dto.nome;
    if (dto.canal !== undefined) t.canal = dto.canal;
    if (dto.assunto !== undefined) t.assunto = dto.assunto;
    if (dto.conteudo !== undefined) t.conteudo = dto.conteudo;
    if (dto.nivelEscalacao !== undefined) t.nivelEscalacao = dto.nivelEscalacao as CobrancaTemplate['nivelEscalacao'];
    if (dto.variaveis !== undefined) t.variaveis = dto.variaveis;
    if (dto.isActive !== undefined) t.isActive = dto.isActive;
    return this.templateRepo.save(t);
  }

  async removeTemplate(orgId: string, id: string) {
    const t = await this.templateRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!t) throw new NotFoundException('Template não encontrado');
    await this.templateRepo.softRemove(t);
    return { id, deleted: true };
  }

  // ─── Execucoes ────────────────────────────────────────────────────────────

  async iniciar(orgId: string, dto: IniciarCobrancaDto) {
    const cadencia = await this.getCadencia(orgId, dto.cadenciaId);
    if (!cadencia.isActive) throw new BadRequestException('Cadência está inativa');
    if (cadencia.etapas.length === 0) throw new BadRequestException('Cadência sem etapas');

    // Verificar se ja existe execucao ativa para esta conta
    const existing = await this.execucaoRepo.findOne({
      where: {
        orgId,
        contaReceberId: dto.contaReceberId,
        status: 'ativa' as const,
        deletedAt: IsNull(),
      },
    });
    if (existing) throw new BadRequestException('Já existe cobrança ativa para esta conta a receber');

    const entity = this.execucaoRepo.create({
      orgId,
      companyId: dto.companyId,
      contaReceberId: dto.contaReceberId,
      cadenciaId: dto.cadenciaId,
      etapaAtual: 0,
      status: 'ativa',
      metadata: {},
    });

    return this.execucaoRepo.save(entity);
  }

  async pausar(orgId: string, id: string, dto: PausarCobrancaDto) {
    const exec = await this.getExecucao(orgId, id);
    if (exec.status !== 'ativa') throw new BadRequestException(`Execução está ${exec.status}`);
    exec.status = 'pausada';
    exec.pausadaEm = new Date();
    exec.motivoPausa = dto.motivo ?? null;
    return this.execucaoRepo.save(exec);
  }

  async retomar(orgId: string, id: string) {
    const exec = await this.getExecucao(orgId, id);
    if (exec.status !== 'pausada') throw new BadRequestException(`Execução está ${exec.status}`);
    exec.status = 'ativa';
    exec.pausadaEm = null;
    exec.motivoPausa = null;
    return this.execucaoRepo.save(exec);
  }

  async cancelar(orgId: string, id: string) {
    const exec = await this.getExecucao(orgId, id);
    if (['concluida', 'cancelada'].includes(exec.status)) {
      throw new BadRequestException(`Execução já está ${exec.status}`);
    }
    exec.status = 'cancelada';
    exec.concluidaEm = new Date();
    return this.execucaoRepo.save(exec);
  }

  async concluir(orgId: string, id: string, resultadoFinal?: string) {
    const exec = await this.getExecucao(orgId, id);
    exec.status = 'concluida';
    exec.concluidaEm = new Date();
    if (resultadoFinal) exec.metadata = { ...exec.metadata, resultadoFinal };
    return this.execucaoRepo.save(exec);
  }

  async listExecucoes(orgId: string, q: ListExecucoesQuery) {
    const qb = this.execucaoRepo.createQueryBuilder('e')
      .where('e.org_id = :orgId AND e.deleted_at IS NULL', { orgId })
      .orderBy('e.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('e.company_id = :cid', { cid: q.companyId });
    if (q.status) qb.andWhere('e.status = :status', { status: q.status });
    if (q.cadenciaId) qb.andWhere('e.cadencia_id = :cadId', { cadId: q.cadenciaId });
    if (q.contaReceberId) qb.andWhere('e.conta_receber_id = :crId', { crId: q.contaReceberId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getExecucao(orgId: string, id: string) {
    const e = await this.execucaoRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('Execução de cobrança não encontrada');
    return e;
  }

  async getAcoes(orgId: string, execucaoId: string) {
    await this.getExecucao(orgId, execucaoId);
    const data = await this.acaoRepo.find({
      where: { execucaoId },
      order: { createdAt: 'ASC' },
    });
    return { data };
  }

  // ─── Processamento ────────────────────────────────────────────────────────

  async executarProximaEtapa(orgId: string, execucaoId: string) {
    const exec = await this.getExecucao(orgId, execucaoId);
    if (exec.status !== 'ativa') throw new BadRequestException(`Execução está ${exec.status}`);

    const cadencia = await this.getCadencia(orgId, exec.cadenciaId);
    const etapas = cadencia.etapas;

    if (exec.etapaAtual >= etapas.length) {
      exec.status = 'concluida';
      exec.concluidaEm = new Date();
      await this.execucaoRepo.save(exec);
      return { concluida: true, message: 'Todas as etapas foram executadas' };
    }

    const etapa = etapas[exec.etapaAtual];

    // Criar acao
    const acao = this.acaoRepo.create({
      execucaoId,
      etapaIndex: exec.etapaAtual,
      canal: etapa.canal,
      templateId: etapa.templateId ?? null,
      agendadaPara: new Date(),
      status: 'agendada',
      custo: '0',
    });
    await this.acaoRepo.save(acao);

    // Avancar etapa
    exec.etapaAtual += 1;
    exec.metadata = {
      ...exec.metadata,
      ultimaEtapaEm: new Date().toISOString(),
    };
    await this.execucaoRepo.save(exec);

    return { concluida: false, acao, etapaAtual: exec.etapaAtual, totalEtapas: etapas.length };
  }

  async processarFila(orgId: string) {
    const execucoes = await this.execucaoRepo.find({
      where: { orgId, status: 'ativa' as const, deletedAt: IsNull() },
    });

    const resultados: Array<{ execucaoId: string; resultado: string }> = [];

    for (const exec of execucoes) {
      try {
        const result = await this.executarProximaEtapa(orgId, exec.id);
        resultados.push({
          execucaoId: exec.id,
          resultado: result.concluida ? 'concluida' : 'etapa_executada',
        });
      } catch (err) {
        resultados.push({
          execucaoId: exec.id,
          resultado: `erro: ${(err as Error).message}`,
        });
      }
    }

    return { processadas: resultados.length, resultados };
  }

  // ─── Render Template ──────────────────────────────────────────────────────

  renderTemplate(conteudo: string, vars: Record<string, string>): string {
    let result = conteudo;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }
}
