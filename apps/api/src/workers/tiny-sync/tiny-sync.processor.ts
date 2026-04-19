import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TinySyncService } from '../../mcps/tiny/tiny-sync.service';

interface TinySyncJob {
  companyId: string;
  dominio: 'cp' | 'cr' | 'contatos';
  from?: string;
  to?: string;
}

@Injectable()
@Processor('tiny-sync', { concurrency: 1 })
export class TinySyncProcessor extends WorkerHost {
  private readonly logger = new Logger('TinySyncWorker');

  constructor(private readonly tinySync: TinySyncService) {
    super();
  }

  async process(job: Job<TinySyncJob>): Promise<unknown> {
    const { companyId, dominio, from, to } = job.data;
    this.logger.log(`Tiny sync ${dominio} company=${companyId}`);

    let stats;
    switch (dominio) {
      case 'cp':
        stats = await this.tinySync.syncCP(companyId, { from, to });
        break;
      case 'cr':
        stats = await this.tinySync.syncCR(companyId, { from, to });
        break;
      case 'contatos':
        stats = await this.tinySync.syncContatos(companyId);
        break;
      default:
        this.logger.warn(`Domínio desconhecido: ${dominio}`);
        return { ok: false, error: `Domínio ${dominio} inválido` };
    }

    this.logger.log(`Tiny sync ${dominio} concluído: ${JSON.stringify(stats)}`);
    return { ok: true, dominio, stats };
  }
}
