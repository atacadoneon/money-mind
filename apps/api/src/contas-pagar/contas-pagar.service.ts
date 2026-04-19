import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ContaPagar, SituacaoCP } from './entities/conta-pagar.entity';
import {
  BaixarContaDto, BulkBaixarDto, BulkIdsDto, BulkUpdateDto, CreateContaPagarDto,
  ImportColumnMapDto, ListContasPagarQuery, UpdateContaPagarDto,
} from './dto/contas-pagar.dto';
import { buildMeta } from '../common/dto/pagination.dto';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Injectable()
export class ContasPagarService {
  constructor(
    @InjectRepository(ContaPagar) private readonly repo: Repository<ContaPagar>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private baseQb(orgId: string) {
    return this.repo.createQueryBuilder('cp').where('cp.org_id = :orgId AND cp.deleted_at IS NULL', { orgId });
  }

  async list(orgId: string, q: ListContasPagarQuery) {
    const qb = this.baseQb(orgId)
      .orderBy(`cp.${q.order_by ?? 'data_vencimento'}`, (q.order_dir ?? 'desc').toUpperCase() as 'ASC' | 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('cp.company_id = :cid', { cid: q.companyId });
    if (q.situacao) qb.andWhere('cp.situacao = :sit', { sit: q.situacao });
    if (q.vencimentoDe) qb.andWhere('cp.data_vencimento >= :vde', { vde: q.vencimentoDe });
    if (q.vencimentoAte) qb.andWhere('cp.data_vencimento <= :vate', { vate: q.vencimentoAte });
    if (q.fornecedorId) qb.andWhere('cp.contato_id = :forn', { forn: q.fornecedorId });
    if (q.categoriaId) qb.andWhere('cp.categoria_id = :cat', { cat: q.categoriaId });
    if (q.marcadorId) qb.andWhere('cp.marcadores @> :marc::jsonb', { marc: JSON.stringify([q.marcadorId]) });
    if (q.search) {
      qb.andWhere(
        '(cp.historico ILIKE :s OR cp.numero_documento ILIKE :s)',
        { s: `%${q.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async summary(orgId: string, companyId?: string) {
    const qb = this.baseQb(orgId);
    if (companyId) qb.andWhere('cp.company_id = :cid', { cid: companyId });
    const rows = await qb
      .select('cp.situacao', 'situacao')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(cp.valor)', 'total')
      .addSelect('SUM(cp.valor_pago)', 'total_pago')
      .groupBy('cp.situacao')
      .getRawMany<{ situacao: SituacaoCP; count: string; total: string; total_pago: string }>();
    const summary: Record<string, { count: number; total: number; totalPago: number }> = {};
    for (const r of rows)
      summary[r.situacao] = { count: Number(r.count), total: Number(r.total), totalPago: Number(r.total_pago) };
    return { data: summary };
  }

  async get(orgId: string, id: string) {
    const cp = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!cp) throw new NotFoundException('Conta a pagar not found');
    return cp;
  }

  async create(orgId: string, dto: CreateContaPagarDto) {
    const entity = this.repo.create({
      orgId, companyId: dto.companyId, historico: dto.descricao,
      valor: String(dto.valor), dataVencimento: dto.dataVencimento,
      dataEmissao: dto.dataEmissao, numeroDocumento: dto.numeroDocumento,
      contatoId: dto.fornecedorId ?? null,
      fornecedorNome: dto.fornecedorNome ?? dto.descricao ?? '',
      categoriaId: dto.categoriaId ?? null,
      formaPagamentoId: dto.formaPagamentoId ?? null, contaBancariaId: dto.contaBancariaId ?? null,
      observacoes: dto.observacoes, marcadores: dto.marcadoresIds ?? [],
      situacao: 'aberto',
    });
    return this.repo.save(entity);
  }

  async update(orgId: string, id: string, dto: UpdateContaPagarDto) {
    const cp = await this.get(orgId, id);
    if (dto.descricao !== undefined) cp.historico = dto.descricao;
    if (dto.valor != null) cp.valor = String(dto.valor);
    if (dto.dataVencimento !== undefined) cp.dataVencimento = dto.dataVencimento;
    if (dto.dataEmissao !== undefined) cp.dataEmissao = dto.dataEmissao;
    if (dto.numeroDocumento !== undefined) cp.numeroDocumento = dto.numeroDocumento;
    if (dto.fornecedorId !== undefined) cp.contatoId = dto.fornecedorId ?? null;
    if (dto.fornecedorNome !== undefined) cp.fornecedorNome = dto.fornecedorNome;
    if (dto.categoriaId !== undefined) cp.categoriaId = dto.categoriaId ?? null;
    if (dto.formaPagamentoId !== undefined) cp.formaPagamentoId = dto.formaPagamentoId ?? null;
    if (dto.contaBancariaId !== undefined) cp.contaBancariaId = dto.contaBancariaId ?? null;
    if (dto.observacoes !== undefined) cp.observacoes = dto.observacoes;
    if (dto.marcadoresIds !== undefined) cp.marcadores = dto.marcadoresIds;
    if (dto.situacao) cp.situacao = dto.situacao;
    return this.repo.save(cp);
  }

  async remove(orgId: string, id: string) {
    const cp = await this.get(orgId, id);
    if (cp.situacao === 'pago') throw new BadRequestException('Cannot delete a paid title; estorne primeiro');
    await this.repo.softRemove(cp);
    return { id, deleted: true };
  }

  async bulkDelete(orgId: string, dto: BulkIdsDto) {
    const rows = await this.repo.find({ where: { id: In(dto.ids), orgId, deletedAt: IsNull() } });
    if (rows.length === 0) return { deleted: 0 };
    await this.dataSource.transaction(async (em) => {
      await em.softRemove(ContaPagar, rows);
      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'bulk', entityType: 'conta_pagar',
        metadata: { ids: dto.ids, operation: 'bulk_delete' },
        changes: {},
      }));
    });
    return { deleted: rows.length };
  }

  async bulkUpdate(orgId: string, dto: BulkUpdateDto) {
    const rows = await this.repo.find({ where: { id: In(dto.ids), orgId, deletedAt: IsNull() } });
    if (rows.length === 0) return { updated: 0 };
    await this.dataSource.transaction(async (em) => {
      for (const r of rows) Object.assign(r, dto.patch);
      await em.save(ContaPagar, rows);
    });
    return { updated: rows.length };
  }

  async bulkBaixar(orgId: string, dto: BulkBaixarDto) {
    const rows = await this.repo.find({
      where: { id: In(dto.ids), orgId, deletedAt: IsNull() },
    });
    if (rows.length === 0) return { baixadas: 0, erros: [] };

    const japagas = rows.filter((r) => r.situacao === 'pago').map((r) => r.id);
    const apagar = rows.filter((r) => r.situacao !== 'pago' && r.situacao !== 'cancelado');
    const erros: string[] = japagas.map((id) => `${id}: already paid`);

    await this.dataSource.transaction(async (em) => {
      for (const cp of apagar) {
        const valorTotal = Number(cp.valor);
        const valorPagoAgora = Number(cp.valorPago) + Number(dto.valorPago ?? valorTotal);
        cp.valorPago = valorPagoAgora.toFixed(2);
        cp.dataPagamento = dto.dataPagamento;
        cp.contaBancariaId = dto.contaBancariaId;
        cp.situacao = valorPagoAgora >= valorTotal - 0.009 ? 'pago' : 'parcial';
      }
      await em.save(ContaPagar, apagar);
    });

    return { baixadas: apagar.length, erros };
  }

  async baixar(orgId: string, id: string, dto: BaixarContaDto) {
    const cp = await this.get(orgId, id);
    if (cp.situacao === 'pago') throw new BadRequestException('Already paid');
    if (cp.situacao === 'cancelado') throw new BadRequestException('Cannot pay a cancelled title');

    const before = { situacao: cp.situacao, valorPago: cp.valorPago };
    const valorTotal = Number(cp.valor);
    const valorPagoAgora = Number(cp.valorPago) + Number(dto.valorPago);

    await this.dataSource.transaction(async (em) => {
      cp.valorPago = valorPagoAgora.toFixed(2);
      cp.dataPagamento = dto.dataPagamento;
      if (dto.contaBancariaId) cp.contaBancariaId = dto.contaBancariaId;
      if (dto.formaPagamentoId) cp.formaPagamentoId = dto.formaPagamentoId;
      cp.situacao = valorPagoAgora >= valorTotal - 0.009 ? 'pago' : 'parcial';
      if (dto.observacoes) cp.observacoes = dto.observacoes;
      await em.save(ContaPagar, cp);

      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'baixar', entityType: 'conta_pagar', entityId: id,
        changes: { before, after: { situacao: cp.situacao, valorPago: cp.valorPago } },
        metadata: { dataPagamento: dto.dataPagamento, contaBancariaId: dto.contaBancariaId },
      }));
    });

    return cp;
  }

  async estornar(orgId: string, id: string, motivo?: string) {
    const cp = await this.get(orgId, id);
    const before = { situacao: cp.situacao, valorPago: cp.valorPago };

    await this.dataSource.transaction(async (em) => {
      cp.valorPago = '0';
      cp.dataPagamento = null;
      cp.situacao = 'aberto';
      await em.save(ContaPagar, cp);

      await em.save(AuditLog, this.auditRepo.create({
        orgId, action: 'estornar', entityType: 'conta_pagar', entityId: id,
        changes: { before, after: { situacao: 'aberto', valorPago: '0' } },
        metadata: { motivo: motivo ?? 'Estorno manual' },
      }));
    });

    return cp;
  }

  // ─── Import XLSX/CSV ──────────────────────────────────────────────────────────

  async importPreview(
    orgId: string,
    companyId: string,
    file: Express.Multer.File,
    columnMap?: ImportColumnMapDto,
  ) {
    const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    const preview = raw.slice(0, 10).map((r) => this.mapRow(r, columnMap));
    return { total: raw.length, preview, columns: Object.keys(raw[0] ?? {}) };
  }

  async importRows(orgId: string, companyId: string, rows: Array<Partial<CreateContaPagarDto>>) {
    const valid = rows.filter((r) => r.descricao && r.valor != null && r.dataVencimento);
    if (valid.length === 0) return { imported: 0, skipped: rows.length, errors: [] };

    const errors: Array<{ line: number; error: string }> = [];
    const toSave: ContaPagar[] = [];

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
          contatoId: r.fornecedorId ?? null,
          fornecedorNome: (r as any).fornecedorNome ?? r.descricao ?? '',
          categoriaId: r.categoriaId ?? null,
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

  async importFromFile(
    orgId: string,
    companyId: string,
    file: Express.Multer.File,
    columnMap?: ImportColumnMapDto,
  ) {
    const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    const mapped = raw.map((r) => this.mapRow(r, columnMap));
    return this.importRows(orgId, companyId, mapped);
  }

  private mapRow(r: Record<string, unknown>, columnMap?: ImportColumnMapDto): Partial<CreateContaPagarDto & { tinyId?: string }> {
    const cm = columnMap ?? {};
    const get = (field: string, fallbacks: string[]) => {
      const key = (cm as Record<string, string>)[field];
      if (key && r[key] !== undefined && r[key] !== null) return r[key];
      for (const fb of fallbacks) {
        if (r[fb] !== undefined && r[fb] !== null) return r[fb];
      }
      return null;
    };

    const valorRaw = get('valor', ['valor', 'Valor', 'VALOR', 'value', 'Value']);
    const vencimentoRaw = get('dataVencimento', ['data_vencimento', 'dataVencimento', 'vencimento', 'Vencimento', 'VENCIMENTO']);

    return {
      descricao: String(get('descricao', ['descricao', 'Descricao', 'historico', 'Historico', 'description']) ?? ''),
      valor: valorRaw != null ? Math.abs(Number(String(valorRaw).replace(/[R$\s.]/g, '').replace(',', '.'))) : 0,
      dataVencimento: this.parseExcelDate(vencimentoRaw),
      numeroDocumento: String(get('numeroDocumento', ['numero_documento', 'numeroDocumento', 'NF', 'documento']) ?? '') || undefined,
      fornecedorId: String(get('fornecedorId', ['fornecedor_id', 'fornecedorId', 'contato_id']) ?? '') || undefined,
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
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `20${y}-${m}-${d}`;
    }
    const n = Number(s);
    if (!isNaN(n) && n > 40000) {
      const d = new Date((n - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    return s;
  }

  // ─── Export XLSX ──────────────────────────────────────────────────────────────

  async exportAll(orgId: string, q: ListContasPagarQuery): Promise<ContaPagar[]> {
    const qb = this.baseQb(orgId).orderBy('cp.data_vencimento', 'ASC');
    if (q.companyId) qb.andWhere('cp.company_id = :cid', { cid: q.companyId });
    if (q.situacao) qb.andWhere('cp.situacao = :sit', { sit: q.situacao });
    if (q.vencimentoDe) qb.andWhere('cp.data_vencimento >= :vde', { vde: q.vencimentoDe });
    if (q.vencimentoAte) qb.andWhere('cp.data_vencimento <= :vate', { vate: q.vencimentoAte });
    return qb.getMany();
  }

  async exportXlsx(orgId: string, q: ListContasPagarQuery): Promise<Buffer> {
    const rows = await this.exportAll(orgId, q);

    const data = rows.map((r) => ({
      Fornecedor: r.contatoId ?? '',
      Histórico: r.historico ?? '',
      Categoria: r.categoriaId ?? '',
      Vencimento: r.dataVencimento,
      Valor: Number(r.valor),
      Saldo: Number(r.valor) - Number(r.valorPago),
      Pago: Number(r.valorPago),
      Situação: r.situacao,
      Marcadores: (r.marcadores ?? []).join(', '),
      'Forma Pagamento': r.formaPagamentoId ?? '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) continue;
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' },
      };
    }

    ws['!cols'] = [
      { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 20 }, { wch: 20 },
    ];

    const totalRow = data.length + 2;
    const totalValor = rows.reduce((acc, r) => acc + Number(r.valor), 0);
    const totalPago = rows.reduce((acc, r) => acc + Number(r.valorPago), 0);
    XLSX.utils.sheet_add_aoa(ws, [
      ['TOTAL', '', '', '', totalValor, totalValor - totalPago, totalPago, '', '', ''],
    ], { origin: { r: totalRow, c: 0 } });

    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: false }) as Buffer;
  }
}
