import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ReconciliationEngine } from './engine/reconciliation.engine';
import { ConfirmMatchDto, IgnoreLinhaDto } from './dto/reconciliation.dto';

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(ExtratoLinha) private readonly linhas: Repository<ExtratoLinha>,
    private readonly engine: ReconciliationEngine,
    @InjectQueue('reconciliation') private readonly queue: Queue,
    @InjectQueue('ai-suggest') private readonly aiQueue: Queue,
  ) {}

  async suggestionsForLinha(orgId: string, linhaId: string) {
    const linha = await this.linhas.findOne({ where: { id: linhaId, orgId } });
    if (!linha) throw new NotFoundException('Linha not found');
    const res = await this.engine.matchLinha(orgId, linha);
    return { data: res };
  }

  async runBatch(orgId: string, extratoId: string) {
    await this.queue.add('match-batch', { orgId, extratoId });
    return { data: { queued: true, extratoId } };
  }

  async confirm(orgId: string, dto: ConfirmMatchDto) {
    const linha = await this.linhas.findOne({ where: { id: dto.linhaId, orgId } });
    if (!linha) throw new NotFoundException('Linha not found');
    if (dto.kind === 'contaPagar') linha.matchContaPagarId = dto.targetId;
    else linha.matchContaReceberId = dto.targetId;
    linha.status = 'conciliado';
    linha.matchStrategy = linha.matchStrategy ?? 'manual';
    linha.matchConfidence = linha.matchConfidence ?? '1.00';
    await this.linhas.save(linha);
    return { data: linha };
  }

  async ignore(orgId: string, dto: IgnoreLinhaDto) {
    const linha = await this.linhas.findOne({ where: { id: dto.linhaId, orgId } });
    if (!linha) throw new NotFoundException('Linha not found');
    linha.status = 'ignorado';
    linha.metadata = { ...linha.metadata, ignoreReason: dto.motivo };
    await this.linhas.save(linha);
    return { data: linha };
  }

  async askAi(orgId: string, linhaId: string) {
    const linha = await this.linhas.findOne({ where: { id: linhaId, orgId } });
    if (!linha) throw new NotFoundException('Linha not found');
    await this.aiQueue.add('suggest', { orgId, linhaId });
    return { data: { queued: true } };
  }

  async stats(orgId: string) {
    const rows = await this.linhas.createQueryBuilder('l')
      .select('l.status', 'status').addSelect('COUNT(*)', 'count')
      .where('l.org_id = :orgId', { orgId }).groupBy('l.status').getRawMany();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = Number(r.count);
    if (!rows.length) throw new BadRequestException('No stats available yet');
    return { data: out };
  }
}
