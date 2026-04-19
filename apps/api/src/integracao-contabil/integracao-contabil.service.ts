import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ExportacaoContabil, StatusExportacao } from './entities/exportacao-contabil.entity';
import { ProvisaoImposto, StatusImposto, TipoImposto } from './entities/provisao-imposto.entity';
import {
  CalendarioFiscalQuery, CreateProvisaoDto, GerarExportacaoDto,
  ListExportacoesQuery, ListProvisoesQuery, UpdateProvisaoDto,
} from './dto/integracao-contabil.dto';
import { buildMeta } from '../common/dto/pagination.dto';

// Datas padrão de vencimento por imposto
const VENCIMENTOS_PADRAO: Record<string, number> = {
  simples: 20, iss: 10, pis: 25, cofins: 25, irpj: 30,
  csll: 30, icms: 15, ipi: 25, inss: 20, fgts: 7,
};

@Injectable()
export class IntegracaoContabilService {
  constructor(
    @InjectRepository(ExportacaoContabil) private readonly exportRepo: Repository<ExportacaoContabil>,
    @InjectRepository(ProvisaoImposto) private readonly provisaoRepo: Repository<ProvisaoImposto>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Exportações ──────────────────────────────────────────────────────────

  async gerarExportacao(orgId: string, userId: string, dto: GerarExportacaoDto) {
    const entity = this.exportRepo.create({
      orgId,
      companyId: dto.companyId,
      competencia: dto.competencia,
      formato: dto.formato as ExportacaoContabil['formato'],
      regime: (dto.regime ?? 'competencia') as ExportacaoContabil['regime'],
      status: 'gerando' as StatusExportacao,
      geradoPor: userId,
      metadata: dto.configuracao ?? {},
    });

    const saved = await this.exportRepo.save(entity);

    // Gerar dados (simplified - real implementation would be async/worker)
    try {
      const [ano, mes] = dto.competencia.split('-').map(Number);
      const regime = dto.regime ?? 'competencia';
      const dateField = regime === 'competencia' ? 'data_vencimento' : 'data_pagamento';

      const [cpResult] = await this.dataSource.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(CAST(valor AS numeric)), 0) as valor
         FROM contas_pagar WHERE org_id = $1 AND company_id = $2
         AND EXTRACT(YEAR FROM ${dateField}) = $3 AND EXTRACT(MONTH FROM ${dateField}) = $4
         AND deleted_at IS NULL`,
        [orgId, dto.companyId, ano, mes],
      );

      const [crResult] = await this.dataSource.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(CAST(valor AS numeric)), 0) as valor
         FROM contas_receber WHERE org_id = $1 AND company_id = $2
         AND EXTRACT(YEAR FROM ${dateField}) = $3 AND EXTRACT(MONTH FROM ${dateField}) = $4
         AND deleted_at IS NULL`,
        [orgId, dto.companyId, ano, mes],
      );

      saved.totalLancamentos = Number(cpResult?.total ?? 0) + Number(crResult?.total ?? 0);
      saved.totalValor = String(Number(crResult?.valor ?? 0) - Number(cpResult?.valor ?? 0));
      saved.status = 'pronto';
      // In real implementation: generate file, upload to storage, set arquivoUrl
    } catch (err) {
      saved.status = 'falhou';
      saved.metadata = { ...saved.metadata, erro: (err as Error).message };
    }

    return this.exportRepo.save(saved);
  }

  async listExportacoes(orgId: string, q: ListExportacoesQuery) {
    const qb = this.exportRepo.createQueryBuilder('e')
      .where('e.org_id = :orgId AND e.deleted_at IS NULL', { orgId })
      .orderBy('e.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('e.company_id = :cid', { cid: q.companyId });
    if (q.competencia) qb.andWhere('e.competencia = :comp', { comp: q.competencia });
    if (q.formato) qb.andWhere('e.formato = :fmt', { fmt: q.formato });
    if (q.status) qb.andWhere('e.status = :status', { status: q.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getExportacao(orgId: string, id: string) {
    const e = await this.exportRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('Exportação não encontrada');
    return e;
  }

  // ─── Provisões ────────────────────────────────────────────────────────────

  async listProvisoes(orgId: string, q: ListProvisoesQuery) {
    const qb = this.provisaoRepo.createQueryBuilder('p')
      .where('p.org_id = :orgId AND p.deleted_at IS NULL', { orgId })
      .orderBy('p.data_vencimento', 'ASC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('p.company_id = :cid', { cid: q.companyId });
    if (q.competencia) qb.andWhere('p.competencia = :comp', { comp: q.competencia });
    if (q.tipoImposto) qb.andWhere('p.tipo_imposto = :tipo', { tipo: q.tipoImposto });
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async createProvisao(orgId: string, dto: CreateProvisaoDto) {
    const valorProvisionado = Math.round(dto.baseCalculo * dto.aliquota / 100 * 100) / 100;

    // Calcular data vencimento padrão se não informada
    let dataVencimento = dto.dataVencimento ?? null;
    if (!dataVencimento) {
      const [ano, mes] = dto.competencia.split('-').map(Number);
      const dia = VENCIMENTOS_PADRAO[dto.tipoImposto] ?? 20;
      const mesSeguinte = mes === 12 ? 1 : mes + 1;
      const anoSeguinte = mes === 12 ? ano + 1 : ano;
      dataVencimento = `${anoSeguinte}-${String(mesSeguinte).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }

    const entity = this.provisaoRepo.create({
      orgId,
      companyId: dto.companyId,
      competencia: dto.competencia,
      tipoImposto: dto.tipoImposto as ProvisaoImposto['tipoImposto'],
      baseCalculo: String(dto.baseCalculo),
      aliquota: String(dto.aliquota),
      valorProvisionado: String(valorProvisionado),
      dataVencimento,
      status: 'provisionado' as StatusImposto,
    });

    return this.provisaoRepo.save(entity);
  }

  async updateProvisao(orgId: string, id: string, dto: UpdateProvisaoDto) {
    const p = await this.provisaoRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException('Provisão não encontrada');

    if (dto.baseCalculo != null) p.baseCalculo = String(dto.baseCalculo);
    if (dto.aliquota != null) p.aliquota = String(dto.aliquota);
    if (dto.baseCalculo != null || dto.aliquota != null) {
      const base = Number(dto.baseCalculo ?? p.baseCalculo);
      const aliq = Number(dto.aliquota ?? p.aliquota);
      p.valorProvisionado = String(Math.round(base * aliq / 100 * 100) / 100);
    }
    if (dto.valorPago != null) p.valorPago = String(dto.valorPago);
    if (dto.status !== undefined) p.status = dto.status as ProvisaoImposto['status'];
    if (dto.guiaUrl !== undefined) p.guiaUrl = dto.guiaUrl;
    if (dto.dataVencimento !== undefined) p.dataVencimento = dto.dataVencimento;

    return this.provisaoRepo.save(p);
  }

  async removeProvisao(orgId: string, id: string) {
    const p = await this.provisaoRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException('Provisão não encontrada');
    await this.provisaoRepo.softRemove(p);
    return { id, deleted: true };
  }

  // ─── Calendário Fiscal ────────────────────────────────────────────────────

  async calendarioFiscal(orgId: string, q: CalendarioFiscalQuery) {
    const competencia = q.competencia ?? new Date().toISOString().slice(0, 7);

    const provisoes = await this.provisaoRepo.find({
      where: { orgId, companyId: q.companyId, competencia, deletedAt: IsNull() },
      order: { dataVencimento: 'ASC' },
    });

    const hoje = new Date().toISOString().slice(0, 10);
    return {
      data: provisoes.map((p) => ({
        id: p.id,
        tipoImposto: p.tipoImposto,
        valor: Number(p.valorProvisionado),
        valorPago: Number(p.valorPago),
        dataVencimento: p.dataVencimento,
        status: p.status,
        atrasado: p.dataVencimento && p.dataVencimento < hoje && p.status === 'provisionado',
      })),
      competencia,
    };
  }

  // ─── Resumo por Tipo ──────────────────────────────────────────────────────

  async resumoImpostos(orgId: string, companyId: string, competencia?: string) {
    const qb = this.provisaoRepo.createQueryBuilder('p')
      .where('p.org_id = :orgId AND p.company_id = :cid AND p.deleted_at IS NULL', { orgId, cid: companyId })
      .select('p.tipo_imposto', 'tipoImposto')
      .addSelect('SUM(CAST(p.valor_provisionado AS numeric))', 'totalProvisionado')
      .addSelect('SUM(CAST(p.valor_pago AS numeric))', 'totalPago')
      .addSelect('COUNT(*)', 'qtd')
      .groupBy('p.tipo_imposto');

    if (competencia) qb.andWhere('p.competencia = :comp', { comp: competencia });

    const rows = await qb.getRawMany();
    return {
      data: rows.map((r) => ({
        tipoImposto: r.tipoImposto,
        totalProvisionado: Number(r.totalProvisionado ?? 0),
        totalPago: Number(r.totalPago ?? 0),
        saldoPendente: Number(r.totalProvisionado ?? 0) - Number(r.totalPago ?? 0),
        qtd: Number(r.qtd),
      })),
    };
  }
}
