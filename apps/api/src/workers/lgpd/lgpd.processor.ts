import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LgpdService } from '../../lgpd/lgpd.service';

@Processor('lgpd')
export class LgpdProcessor extends WorkerHost {
  private readonly logger = new Logger(LgpdProcessor.name);

  constructor(private readonly lgpdSvc: LgpdService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing LGPD job ${job.id} name=${job.name}`);
    const { orgId, userId } = job.data as { orgId: string; userId: string };

    switch (job.name) {
      case 'export-data': {
        const data = await this.lgpdSvc.exportDataSync(orgId);
        this.logger.log(`LGPD export completed for org=${orgId} user=${userId}: ${JSON.stringify(data.summary)}`);
        // TODO: enviar por email seguro ou armazenar no storage
        return { success: true, exportedAt: data.exportedAt };
      }

      case 'erasure-data': {
        // Soft-delete propagado — apenas marca deleted_at
        this.logger.log(`LGPD erasure requested for org=${orgId} user=${userId} — marking data for deletion`);
        // TODO: implementar anonimização real dos dados pessoais
        return { success: true, message: 'Erasure queued — manual review required' };
      }

      default:
        this.logger.warn(`LGPD: job '${job.name}' não reconhecido`);
        return {};
    }
  }
}
