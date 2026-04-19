import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ContaReceber } from './entities/conta-receber.entity';
import {
  BaixarReceberDto, BulkBaixarCRDto, BulkCRIdsDto, BulkCRUpdateDto,
  CreateContaReceberDto, ImportCRColumnMapDto, ListContasReceberQuery, UpdateContaReceberDto,
} from './dto/contas-receber.dto';
import { buildMeta } from '../common/dto/pagination.dto';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Injectable()
export class ContasReceberService {
  constructor(
    @InjectRepository(ContaReceber) private readonly repo: Repository<ContaReceber>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private baseQb(orgId: string) {
    return this.repo.createQueryBuilder('cr').where('cr.org_id = :orgId AND cr.deleted_at IS NULL', { orgId });
  }

  async list(orgId: string, q: ListContasReceberQuery) {
    const qb = this.baseQb(orgId)
      .orderBy(`cr.${q.order_by ?? 'data_vencimento'}`, (q.order_dir ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);
    if (q.companyId) qb.andWhere('cr.company_id = :cid', { cid: q.companyId });
    if (q.situacao) qb.andWhere('cr.situacao = :sit', { sit: q.situacao });
    if (q.vencimentoDe) qb.andWhere('cr.data_vencimento >= :vde', { vde: q.vencimentoDe });
    if (q.vencimentoAte) qb.andWhere('cr.data_vencimento <= :vate', { vate: q.vencimentoAte });
    if (q.clienteId) qb.andWhere('cr.contato_id = :cli', { cli: q.clienteId });
    if (q.categoriaId) qb.andWhere('cr.categoria_id = :cat', { cat: q.categoriaId });
    if (q.marcadorId) qb.andWhere('cr.marcadores @> :marc::jsonb', { marc: JSON.stringify([q.marcadorId]) });
    if (q.search) {
      qb.andWhere('(cr.historico ILIKE :s OR cr.numero_documento ILIKE :s)',
        { s: `%${q.search}%` });
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async summary(orgId: string, companyId?: string) {
    const qb = this.baseQb(orgId);
    if (companyId) qb.andWhere('cr.company_id = :cid', { cid: companyId });
    const rows = await qb
      .select('cr.situacao', 'situacao')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(cr.valor)', 'total')
      .addSelect('SUM(cr.valor_recebido)', 'total_recebido')
      .groupBy('cr.situacao')
      .getRawMany<{ situacao: string; count: string; total: string; total_recebido: string }>();
    const summary: Record<string, { count: number; total: number; totalRecebido: number }> = {};
    for (const r of rows)
      summary[r.situacao] = { count: Number(r.count), total: Number(r.total), totalRecebido: Number(r.total_recebido) };
    return { data: summary };
  }

  async get(orgId: string, id: string) {
    const cr = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!cr) throw new NotFoundException('Conta a receber not found');
    return cr;
  }

  async create(orgId: string, dto: CreateContaReceberDto) {
    const entity = this.repo.create({
      orgId, companyId: dto.companyId, historico: dto.descricao,
      valor: String(dto.valor), dataVencimento: dto.dataVencimento,
      dataEmissao: dto.dataEmissao, numeroDocumento: dto.numeroDocumento,
      contatoId: dto.clienteId ?? null, categoriaId: dto.categoriaId ?? null,
      formaPagamentoId: dto.formaPagamentoId ?? null, contaBancariaId: dto.contaBancariaId ?? null,
      observacoes: dto.observacoes, marcadores: dto.marcadoresIds ?? [], situacao: 'aberto',
    });
    return this.repo.save(entity);
  }

  async update(orgId: string, id: string, dto: UpdateContaReceberDto) {
    const cr = await this.get(orgId, id);
    if (dto.descricao !== undefined) cr.historico = dto.descricao;
    if (dto.valor != null) cr.valor = String(dto.valor);
    if (dto.dataVencimento !== undefined) cr.dataVencimento = dto.dataVencimento;
    if (dto.dataEmissao !== undefined) cr.dataEmissao = dto.dataEmissao;
    if (dto.numeroDocumento !== undefined) cr.numeroDocumento = dto.numeroDocumento;
    if (dto.clienteId !== undefined) cr.contatoId = dto.clienteId ?? null;
    if (dto.categoriaId !== undefined) cr.categoriaId = dto.categoriaId ?? null;
    if (dto.formaPagamentoId !== undefined) cr.formaPagamentoId = dto.formaPagamentoId ?? null;
    if (dto.contaBancariaId !== undefined) cr.contaBancariaId = dto.contaBancariaId ?? null;
    if (dto.observacoes !== undefined) cr.observacoes = dto.observacoes;
    if (dto.marcadoresIds !== undefined) cr.marcadores = dto.marcadoresIds;
    if (dto.situacao) cr.situacao = dto.situacao;
    return this.repo.save(cr);
  }

  async remove(orgId: string, id: string) {
    const cr = await this.get(orgId, id);
    if (cr.situacao === 'recebido') throw new BadRequestException('Cannot delete a received title; estorne primeiro');
    await this.repo.softRemove(cr);
    return { id, deleted: true };
  }

  async bulkDelete(orgId: string, dto: BulkCRIdsDto) {
    const rows = await this.repo.find({ where: { id: In(dto.ids), orgId, deletedAt: IsNull() } });
    if (rows.length === 0) return { deleted: 0 };
    await this.dataSource.transaction(async (em) => {
      await em.softRemove(ContaReceber, rows);
      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'bulk', entityType: 'conta_receber',
        metadata: { ids: dto.ids, operation: 'bulk_delete' },
        changes: {},
      }));
    });
    return { deleted: rows.length };
  }

  async bulkUpdate(orgId: string, dto: BulkCRUpdateDto) {
    const rows = await this.repo.find({ where: { id: In(dto.ids), orgId, deletedAt: IsNull() } });
    if (rows.length === 0) return { updated: 0 };
    await this.dataSource.transaction(async (em) => {
      for (const r of rows) Object.assign(r, dto.patch);
      await em.save(ContaReceber, rows);
    });
    return { updated: rows.length };
  }

  async bulkBaixar(orgId: string, dto: BulkBaixarCRDto) {
    const rows = await this.repo.find({
      where: { id: In(dto.ids), orgId, deletedAt: IsNull() },
    });
    if (rows.length === 0) return { baixadas: 0, erros: [] };

    const jarecebidas = rows.filter((r) => r.situacao === 'recebido').map((r) => r.id);
    const areceber = rows.filter((r) => r.situacao !== 'recebido' && r.situacao !== 'cancelado');
    const erros: string[] = jarecebidas.map((id) => `${id}: already received`);

    await this.dataSource.transaction(async (em) => {
      for (const cr of areceber) {
        const valorTotal = Number(cr.valor);
        const recebidoAgora = Number(cr.valorRecebido) + Number(dto.valorRecebido ?? valorTotal);
        cr.valorRecebido = recebidoAgora.toFixed(2);
        cr.dataRecebimento = dto.dataRecebimento;
        cr.contaBancariaId = dto.contaBancariaId;
        cr.situacao = recebidoAgora >= valorTotal - 0.009 ? 'recebido' : 'parcial';
      }
      await em.save(ContaReceber, areceber);
    });

    return { baixadas: areceber.length, erros };
  }

  async baixar(orgId: string, id: string, dto: BaixarReceberDto) {
    const cr = await this.get(orgId, id);
    if (cr.situacao === 'recebido') throw new BadRequestException('Already received');
    if (cr.situacao === 'cancelado') throw new BadRequestException('Cannot receive a cancelled title');

    const before = { situacao: cr.situacao, valorRecebido: cr.valorRecebido };
    const total = Number(cr.valor);
    const recebidoAgora = Number(cr.valorRecebido) + Number(dto.valorRecebido);

    await this.dataSource.transaction(async (em) => {
      cr.valorRecebido = recebidoAgora.toFixed(2);
      cr.dataRecebimento = dto.dataRecebimento;
      if (dto.contaBancariaId) cr.contaBancariaId = dto.contaBancariaId;
      if (dto.formaPagamentoId) cr.formaPagamentoId = dto.formaPagamentoId;
      cr.situacao = recebidoAgora >= total - 0.009 ? 'recebido' : 'parcial';
      await em.save(ContaReceber, cr);

      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'baixar', entityType: 'conta_receber', entityId: id,
        changes: { before, after: { situacao: cr.situacao, valorRecebido: cr.valorRecebido } },
        metadata: { dataRecebimento: dto.dataRecebimento, contaBancariaId: dto.contaBancariaId },
      }));
    });

    return cr;
  }

  async estornar(orgId: string, id: string, motivo?: string) {
    const cr = await this.get(orgId, id);
    const before = { situacao: cr.situacao, valorRecebido: cr.valorRecebido };

    await this.dataSource.transaction(async (em) => {
      cr.valorRecebido = '0';
      cr.dataRecebimento = null;
      cr.situacao = 'aberto';
      await em.save(ContaReceber, cr);

      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'estornar', entityType: 'conta_receber', entityId: id,
        changes: { before, after: { situacao: 'aberto', valorRecebido: '0' } },
        metadata: { motivo: motivo ?? 'Estorno manual' },
      }));
    });

    return cr;
  }

  // ─── Import ───────────────────────────────────────────────────────────────────

  async importPreview(
    orgId: string,
    companyId: string,
    file: Express.Multer.File,
    columnMap?: ImportCRColumnMapDto,
  ) {
    const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    const preview = raw.slice(0, 10).map((r) => this.mapRow(r, columnMap));
    return { total: raw.length, preview, columns: Object.keys(raw[0] ?? {}) };
  }

  async importFromFile(
    orgId: string,
    companyId: string,
    file: Express.Multer.File,
    columnMap?: ImportCRColumnMapDto,
  ) {
    const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    return this.importRows(orgId, companyId, raw.map((r) => this.mapRow(r, columnMap)));
  }

  async importRows(
    orgId: string,
    companyId: string,
    rows: Array<Partial<CreateContaReceberDto & { tinyId?: string }>>,
  ) {
    const valid = rows.filter((r) => r.descricao && r.valor != null && r.dataVencimento);
    const errors: Array<{ line: number; error: string }> = [];
    const toSave: ContaReceber[] = [];

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      try {
        if (!r.dataVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(r.dataVencimento)) {
          errors.push({ line: i + 1, error: `dataVencimento inválida: ${r.dataVencimento}` });
          continue;
        }
        if (r.valor === undefined || r.valor < 0) {
          errors.push({ line: i + 1, error: `valor inválido: ${r.valor}` });
          continue;
        }

        if (r.tinyId) {
          const existing = await this.repo.findOne({ where: { tinyId: String(r.tinyId), orgId } });
          if (existing) {
            existing.historico = r.descricao;
            existing.valor = String(r.valor);
            existing.dataVencimento = r.dataVencimento;
            toSave.push(existing);
            continue;
          }
        }

        toSave.push(this.repo.create({
          orgId, companyId,
          historico: r.descricao!, valor: String(r.valor), dataVencimento: r.dataVencimento!,
          numeroDocumento: r.numeroDocumento,
          contatoId: r.clienteId ?? null, categoriaId: r.categoriaId ?? null,
          situacao: 'aberto', marcadores: [],
          tinyId: r.tinyId ? String(r.tinyId) : undefined,
        }));
      } catch (err) {
        errors.push({ line: i + 1, error: (err as Error).message });
      }
    }

    if (toSave.length > 0) await this.repo.save(toSave);
    return { imported: toSave.length, skipped: rows.length - valid.length, errors };
  }

  private mapRow(
    r: Record<string, unknown>,
    columnMap?: ImportCRColumnMapDto,
  ): Partial<CreateContaReceberDto & { tinyId?: string }> {
    const cm = columnMap ?? {};
    const get = (field: string, fallbacks: string[]) => {
      const key = (cm as Record<string, string>)[field];
      if (key && r[key] !== undefined && r[key] !== null) return r[key];
      for (const fb of fallbacks) {
        if (r[fb] !== undefined && r[fb] !== null) return r[fb];
      }
      return null;
    };

    const valorRaw = get('valor', ['valor', 'Valor', 'VALOR', 'value']);
    const vencimentoRaw = get('dataVencimento', ['data_vencimento', 'dataVencimento', 'vencimento', 'Vencimento']);

    return {
      descricao: String(get('descricao', ['descricao', 'Descricao', 'historico', 'description']) ?? ''),
      valor: valorRaw != null ? Math.abs(Number(String(valorRaw).replace(/[R$\s.]/g, '').replace(',', '.'))) : 0,
      dataVencimento: this.parseExcelDate(vencimentoRaw),
      numeroDocumento: String(get('numeroDocumento', ['numero_documento', 'NF', 'documento']) ?? '') || undefined,
      clienteId: String(get('clienteId', ['cliente_id', 'clienteId', 'contato_id']) ?? '') || undefined,
      categoriaId: String(get('categoriaId', ['categoria_id', 'categoriaId']) ?? '') || undefined,
      tinyId: String(get('tinyId', ['tiny_id', 'tinyId', 'id_tiny']) ?? '') || undefined,
    };
  }

  private parseExcelDate(raw: unknown): string {
    if (!raw) return '';
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m}-${d}`;
    }
    const n = Number(s);
    if (!isNaN(n) && n > 40000) {
      const d = new Date((n - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    return s;
  }

  // ─── Export XLSX ──────────────────────────────────────────────────────────────

  async exportXlsx(orgId: string, q: ListContasReceberQuery): Promise<Buffer> {
    const qb = this.baseQb(orgId).orderBy('cr.data_vencimento', 'ASC');
    if (q.companyId) qb.andWhere('cr.company_id = :cid', { cid: q.companyId });
    if (q.situacao) qb.andWhere('cr.situacao = :sit', { sit: q.situacao });
    if (q.vencimentoDe) qb.andWhere('cr.data_vencimento >= :vde', { vde: q.vencimentoDe });
    if (q.vencimentoAte) qb.andWhere('cr.data_vencimento <= :vate', { vate: q.vencimentoAte });
    const rows = await qb.getMany();

    const data = rows.map((r) => ({
      Cliente: r.contatoId ?? '',
      Histórico: r.historico ?? '',
      Categoria: r.categoriaId ?? '',
      Vencimento: r.dataVencimento,
      Valor: Number(r.valor),
      Saldo: Number(r.valor) - Number(r.valorRecebido),
      Recebido: Number(r.valorRecebido),
      Situação: r.situacao,
      Marcadores: (r.marcadores ?? []).join(', '),
      'Forma Pagamento': r.formaPagamentoId ?? '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
      { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 20 }, { wch: 20 },
    ];

    const totalValor = rows.reduce((acc, r) => acc + Number(r.valor), 0);
    const totalRecebido = rows.reduce((acc, r) => acc + Number(r.valorRecebido), 0);
    const totalRow = data.length + 2;
    XLSX.utils.sheet_add_aoa(ws, [
      ['TOTAL', '', '', '', totalValor, totalValor - totalRecebido, totalRecebido, '', '', ''],
    ], { origin: { r: totalRow, c: 0 } });

    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
