import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ExtratoBancario } from '../../extratos-bancarios/entities/extrato.entity';
import { ExtratoLinha } from '../../extratos-bancarios/entities/extrato-linha.entity';

interface ExtratoParseJob {
  extratoId: string;
  orgId: string;
}

@Injectable()
@Processor('extrato-parse', { concurrency: 2 })
export class ExtratoParseProcessor extends WorkerHost {
  private readonly logger = new Logger('ExtratoParseWorker');

  constructor(
    @InjectRepository(ExtratoBancario) private readonly extratos: Repository<ExtratoBancario>,
    @InjectRepository(ExtratoLinha) private readonly linhas: Repository<ExtratoLinha>,
    @InjectQueue('reconciliation') private readonly reconcQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ExtratoParseJob>): Promise<unknown> {
    const { extratoId, orgId } = job.data;
    this.logger.log(`Processing extrato ${extratoId}`);

    try {
      // Verifica se extrato existe
      const extrato = await this.extratos.findOne({ where: { id: extratoId, orgId } });
      if (!extrato) {
        this.logger.warn(`Extrato ${extratoId} não encontrado`);
        return { ok: false, error: 'Extrato not found' };
      }

      // Conta linhas pendentes
      const totalLinhas = await this.linhas.count({
        where: { extratoId, orgId, status: 'pendente' },
      });

      // Atualiza extrato como processado
      await this.extratos.update({ id: extratoId }, {
        status: 'processado',
        totalLinhas,
      });

      // Enfileira reconciliação
      const reconcJobId = `reconciliation:${extratoId}:${Date.now()}`;
      await this.reconcQueue.add(
        'match-batch',
        { orgId, extratoId },
        { jobId: reconcJobId, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );

      this.logger.log(`Extrato ${extratoId}: ${totalLinhas} linhas → reconciliation enfileirado`);
      return { ok: true, extratoId, totalLinhas, reconcJobId };
    } catch (err) {
      await this.extratos.update({ id: extratoId }, { status: 'erro' });
      throw err;
    }
  }
}
