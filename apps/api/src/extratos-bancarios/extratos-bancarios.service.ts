import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { ExtratoBancario } from './entities/extrato.entity';
import { ExtratoLinha } from './entities/extrato-linha.entity';
import { OfxParserService } from './ofx/ofx-parser.service';
import { buildMeta, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ExtratosBancariosService {
  constructor(
    @InjectRepository(ExtratoBancario) private readonly extratos: Repository<ExtratoBancario>,
    @InjectRepository(ExtratoLinha) private readonly linhas: Repository<ExtratoLinha>,
    @InjectQueue('extrato-parse') private readonly extratoQueue: Queue,
    private readonly ofxParser: OfxParserService,
  ) {}

  async listExtratos(orgId: string, q: PaginationDto & { contaBancariaId?: string; companyId?: string }) {
    const qb = this.extratos.createQueryBuilder('e')
      .where('e.org_id = :orgId AND e.deleted_at IS NULL', { orgId })
      .orderBy('e.created_at', 'DESC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.contaBancariaId) qb.andWhere('e.conta_bancaria_id = :cb', { cb: q.contaBancariaId });
    if (q.companyId) qb.andWhere('e.company_id = :c', { c: q.companyId });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getExtrato(orgId: string, id: string) {
    const e = await this.extratos.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('Extrato not found');
    return e;
  }

  async listLinhas(orgId: string, extratoId: string, q: PaginationDto & { status?: string }) {
    const qb = this.linhas.createQueryBuilder('l')
      .where('l.org_id = :orgId AND l.extrato_id = :eid', { orgId, eid: extratoId })
      .orderBy('l.data_movimento', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);
    if (q.status) qb.andWhere('l.status = :s', { s: q.status });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async uploadOfx(params: {
    orgId: string;
    companyId: string;
    contaBancariaId: string;
    file: Express.Multer.File;
  }) {
    // Usar o novo OfxParserService com suporte multi-banco
    const parsed = this.ofxParser.parse(params.file.buffer, params.contaBancariaId);

    const extrato = await this.extratos.save(
      this.extratos.create({
        orgId: params.orgId,
        companyId: params.companyId,
        contaBancariaId: params.contaBancariaId,
        nomeArquivo: params.file.originalname,
        periodoInicio: parsed.periodoInicio,
        periodoFim: parsed.periodoFim,
        status: 'pendente',
        totalLinhas: parsed.transactions.length,
        metadata: { bancoSlug: parsed.bancoSlug, bankId: parsed.bankId },
      }),
    );

    // Deduplicação: busca fitidHashes já existentes para esta conta
    const existingHashes = await this.linhas
      .createQueryBuilder('l')
      .select('l.fitid', 'fitid')
      .where('l.conta_bancaria_id = :cb AND l.org_id = :orgId', {
        cb: params.contaBancariaId,
        orgId: params.orgId,
      })
      .getRawMany<{ fitid: string }>();
    const knownFitids = new Set(existingHashes.map((r) => r.fitid));

    const novas = parsed.transactions.filter((t) => !knownFitids.has(t.fitid));
    const duplicadas = parsed.transactions.length - novas.length;

    const linhas = novas.map((t) =>
      this.linhas.create({
        orgId: params.orgId,
        extratoId: extrato.id,
        contaBancariaId: params.contaBancariaId,
        dataMovimento: t.dataMovimento,
        tipo: t.tipo,
        valor: String(t.valor),
        descricao: t.descricao,
        historico: t.historico,
        fitid: t.fitid,
        status: 'pendente',
        metadata: { fitidHash: t.fitidHash, bankId: t.bankId, isPix: t.isPix },
      }),
    );

    if (linhas.length > 0) {
      await this.linhas.save(linhas);
    }

    // Atualiza total real (sem duplicatas)
    await this.extratos.update({ id: extrato.id }, { totalLinhas: linhas.length });

    const jobId = `extrato-parse:${extrato.id}`;
    await this.extratoQueue.add(
      'parse-and-match',
      { extratoId: extrato.id, orgId: params.orgId },
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    return {
      data: {
        extratoId: extrato.id,
        totalTransacoes: parsed.transactions.length,
        novas: linhas.length,
        duplicadas,
        bancoSlug: parsed.bancoSlug,
      },
    };
  }
}
