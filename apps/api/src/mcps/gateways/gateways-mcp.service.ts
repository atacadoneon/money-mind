import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransacaoVenda, GatewaySlug } from './entities/transacao-venda.entity';
import { PagarmeClient } from './pagarme/pagarme.client';
import { AppmaxClient } from './appmax/appmax.client';
import { Company } from '../../companies/entities/company.entity';
import { buildMeta, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class GatewaysMcpService {
  private readonly logger = new Logger(GatewaysMcpService.name);

  constructor(
    @InjectRepository(TransacaoVenda)
    private readonly transacoesRepo: Repository<TransacaoVenda>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    private readonly pagarme: PagarmeClient,
    private readonly appmax: AppmaxClient,
  ) {}

  async listTransacoes(
    orgId: string,
    query: PaginationDto & {
      gateway?: string;
      status?: string;
      from?: string;
      to?: string;
      companyId?: string;
    },
  ) {
    const qb = this.transacoesRepo
      .createQueryBuilder('t')
      .where('t.org_id = :orgId AND t.deleted_at IS NULL', { orgId })
      .orderBy('t.data_transacao', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.gateway) qb.andWhere('t.gateway = :gateway', { gateway: query.gateway });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.from) qb.andWhere('t.data_transacao >= :from', { from: query.from });
    if (query.to) qb.andWhere('t.data_transacao <= :to', { to: query.to });
    if (query.companyId) qb.andWhere('t.company_id = :cid', { cid: query.companyId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, query.page, query.limit) };
  }

  async syncPagarme(companyId: string, orgId: string, apiKey: string, createdSince?: string) {
    const orders = await this.pagarme.getAllOrders(apiKey, createdSince);
    this.logger.log(`Pagar.me sync company=${companyId}: ${orders.length} orders`);

    let upserted = 0;
    for (const order of orders) {
      const norm = this.pagarme.normalizeOrder(order, companyId);
      await this.upsertTransacao({ ...norm, orgId });
      upserted++;
    }

    return { synced: upserted };
  }

  async syncAppmaxCSV(companyId: string, orgId: string, csvBuffer: Buffer) {
    const rows = this.appmax.parseCSV(csvBuffer, companyId);
    this.logger.log(`Appmax CSV company=${companyId}: ${rows.length} rows`);

    let upserted = 0;
    for (const row of rows) {
      await this.upsertTransacao({ ...row, orgId });
      upserted++;
    }

    return { synced: upserted };
  }

  private async upsertTransacao(data: {
    orgId: string;
    companyId: string;
    gateway: GatewaySlug;
    externalId: string;
    valorBruto: number;
    valorTaxa: number;
    valorLiquido: number;
    status: string;
    pedidoRef?: string;
    clienteNome?: string;
    parcelas: number;
    dataTransacao: string;
    dataLiquidacao: string | null;
    rawData: object;
  }) {
    const existing = await this.transacoesRepo.findOne({
      where: { orgId: data.orgId, gateway: data.gateway, externalId: data.externalId },
    });

    if (existing) {
      await this.transacoesRepo.update(existing.id, {
        status: data.status,
        valorLiquido: String(data.valorLiquido),
        dataLiquidacao: data.dataLiquidacao ?? undefined,
        rawData: data.rawData,
      });
    } else {
      await this.transacoesRepo.save(
        this.transacoesRepo.create({
          orgId: data.orgId,
          companyId: data.companyId,
          gateway: data.gateway,
          externalId: data.externalId,
          valorBruto: String(data.valorBruto),
          valorTaxa: String(data.valorTaxa),
          valorLiquido: String(data.valorLiquido),
          status: data.status,
          pedidoRef: data.pedidoRef,
          clienteNome: data.clienteNome,
          parcelas: data.parcelas,
          dataTransacao: data.dataTransacao,
          dataLiquidacao: data.dataLiquidacao ?? undefined,
          rawData: data.rawData,
        }),
      );
    }
  }
}
