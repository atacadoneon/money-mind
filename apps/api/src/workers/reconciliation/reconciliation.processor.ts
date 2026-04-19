import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReconciliationEngine } from '../../reconciliation/engine/reconciliation.engine';

@Processor('reconciliation')
export class ReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger('ReconciliationWorker');
  constructor(private readonly engine: ReconciliationEngine) { super(); }

  async process(job: Job<{ orgId: string; extratoId: string }>): Promise<unknown> {
    this.logger.log(`Batch reconciliation ${job.data.extratoId}`);
    return this.engine.matchBatch(job.data.orgId, job.data.extratoId);
  }
}
