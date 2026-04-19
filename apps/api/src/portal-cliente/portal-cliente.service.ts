import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PortalSessao } from './entities/portal-sessao.entity';
import { PortalPendencia, StatusPendencia } from './entities/portal-pendencia.entity';
import { PortalMensagem } from './entities/portal-mensagem.entity';
import {
  CriarMensagemDto, CriarPendenciaDto, CriarSessaoDto,
  ListMensagensQuery, ListPendenciasQuery, ResolverPendenciaDto,
} from './dto/portal-cliente.dto';
import { buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class PortalClienteService {
  constructor(
    @InjectRepository(PortalSessao) private readonly sessaoRepo: Repository<PortalSessao>,
    @InjectRepository(PortalPendencia) private readonly pendenciaRepo: Repository<PortalPendencia>,
    @InjectRepository(PortalMensagem) private readonly mensagemRepo: Repository<PortalMensagem>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Sessões ──────────────────────────────────────────────────────────────

  async criarSessao(orgId: string, dto: CriarSessaoDto) {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const entity = this.sessaoRepo.create({
      orgId,
      companyId: dto.companyId,
      token,
      emailCliente: dto.emailCliente,
      nomeCliente: dto.nomeCliente ?? null,
      expiresAt,
      isActive: true,
    });

    await this.sessaoRepo.save(entity);
    return { token, expiresAt, sessionId: entity.id };
  }

  async validarSessao(token: string) {
    const sessao = await this.sessaoRepo.findOne({
      where: { token, isActive: true, expiresAt: MoreThan(new Date()) },
    });
    if (!sessao) return null;

    sessao.lastAccess = new Date();
    await this.sessaoRepo.save(sessao);
    return sessao;
  }

  async expirarSessao(id: string) {
    const s = await this.sessaoRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Sessão não encontrada');
    s.isActive = false;
    return this.sessaoRepo.save(s);
  }

  // ─── Pendências ───────────────────────────────────────────────────────────

  async listPendencias(orgId: string, q: ListPendenciasQuery) {
    const qb = this.pendenciaRepo.createQueryBuilder('p')
      .where('p.org_id = :orgId', { orgId })
      .orderBy('p.prazo', 'ASC', 'NULLS LAST')
      .addOrderBy('p.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('p.company_id = :cid', { cid: q.companyId });
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.tipo) qb.andWhere('p.tipo = :tipo', { tipo: q.tipo });
    if (q.search) qb.andWhere('(p.titulo ILIKE :s OR p.descricao ILIKE :s)', { s: `%${q.search}%` });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async criarPendencia(orgId: string, dto: CriarPendenciaDto) {
    const entity = this.pendenciaRepo.create({
      orgId,
      companyId: dto.companyId,
      titulo: dto.titulo,
      descricao: dto.descricao ?? null,
      tipo: dto.tipo as PortalPendencia['tipo'],
      status: 'pendente',
      entidadeTipo: dto.entidadeTipo ?? null,
      entidadeId: dto.entidadeId ?? null,
      prazo: dto.prazo ? new Date(dto.prazo) : null,
    });
    return this.pendenciaRepo.save(entity);
  }

  async resolverPendencia(orgId: string, id: string, dto: ResolverPendenciaDto) {
    const p = await this.pendenciaRepo.findOne({ where: { id, orgId } });
    if (!p) throw new NotFoundException('Pendência não encontrada');
    p.status = 'resolvida';
    p.resolvidaEm = new Date();
    p.resposta = dto.resposta ?? null;
    return this.pendenciaRepo.save(p);
  }

  async cancelarPendencia(orgId: string, id: string) {
    const p = await this.pendenciaRepo.findOne({ where: { id, orgId } });
    if (!p) throw new NotFoundException('Pendência não encontrada');
    p.status = 'cancelada';
    return this.pendenciaRepo.save(p);
  }

  // ─── Mensagens ────────────────────────────────────────────────────────────

  async listMensagens(orgId: string, q: ListMensagensQuery) {
    const qb = this.mensagemRepo.createQueryBuilder('m')
      .where('m.org_id = :orgId AND m.company_id = :cid', { orgId, cid: q.companyId })
      .orderBy('m.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.competencia) qb.andWhere('m.competencia = :comp', { comp: q.competencia });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async enviarMensagem(orgId: string, dto: CriarMensagemDto) {
    const entity = this.mensagemRepo.create({
      orgId,
      companyId: dto.companyId,
      remetenteTipo: dto.remetenteTipo as PortalMensagem['remetenteTipo'],
      remetenteId: dto.remetenteId ?? null,
      conteudo: dto.conteudo,
      competencia: dto.competencia ?? null,
      entidadeTipo: dto.entidadeTipo ?? null,
      entidadeId: dto.entidadeId ?? null,
    });
    return this.mensagemRepo.save(entity);
  }

  async marcarLida(orgId: string, id: string) {
    const m = await this.mensagemRepo.findOne({ where: { id, orgId } });
    if (!m) throw new NotFoundException('Mensagem não encontrada');
    m.lida = true;
    m.lidaEm = new Date();
    return this.mensagemRepo.save(m);
  }

  // ─── Dashboard do Cliente ─────────────────────────────────────────────────

  async dashboard(orgId: string, companyId: string) {
    try {
      const [cpSemana] = await this.dataSource.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(CAST(valor AS numeric)), 0) as valor
         FROM contas_pagar WHERE org_id = $1 AND company_id = $2
         AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
         AND situacao = 'aberto' AND deleted_at IS NULL`,
        [orgId, companyId],
      );

      const [crAtrasadas] = await this.dataSource.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(CAST(valor AS numeric)), 0) as valor
         FROM contas_receber WHERE org_id = $1 AND company_id = $2
         AND data_vencimento < CURRENT_DATE AND situacao = 'aberto' AND deleted_at IS NULL`,
        [orgId, companyId],
      );

      const pendenciasPendentes = await this.pendenciaRepo.count({
        where: { orgId, companyId, status: 'pendente' as StatusPendencia },
      });

      const msgsNaoLidas = await this.mensagemRepo.count({
        where: { orgId, companyId, remetenteTipo: 'analista', lida: false },
      });

      return {
        cpSemana: { total: Number(cpSemana?.total ?? 0), valor: Number(cpSemana?.valor ?? 0) },
        crAtrasadas: { total: Number(crAtrasadas?.total ?? 0), valor: Number(crAtrasadas?.valor ?? 0) },
        pendenciasPendentes,
        msgsNaoLidas,
      };
    } catch {
      return { cpSemana: { total: 0, valor: 0 }, crAtrasadas: { total: 0, valor: 0 }, pendenciasPendentes: 0, msgsNaoLidas: 0 };
    }
  }
}
