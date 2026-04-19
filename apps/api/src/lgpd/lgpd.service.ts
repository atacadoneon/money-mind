import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { Contato } from '../contatos/entities/contato.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { Consent, ConsentType } from './entities/consent.entity';

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(
    @InjectRepository(ContaPagar) private readonly cpRepo: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crRepo: Repository<ContaReceber>,
    @InjectRepository(Contato) private readonly contatosRepo: Repository<Contato>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Consent) private readonly consentRepo: Repository<Consent>,
    @InjectQueue('lgpd') private readonly lgpdQueue: Queue,
  ) {}

  // ─── Export Request ──────────────────────────────────────────────────────

  async requestExport(userId: string, orgId: string) {
    const job = await this.lgpdQueue.add(
      'export-data',
      { userId, orgId },
      { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
    );
    return {
      jobId: job.id,
      message: 'Exportação LGPD enfileirada. Você receberá os dados por e-mail em até 24 horas.',
      estimatedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  // ─── Erasure Request ─────────────────────────────────────────────────────

  async requestErasure(userId: string, orgId: string) {
    const job = await this.lgpdQueue.add(
      'erasure-data',
      { userId, orgId, requestedAt: new Date().toISOString() },
      { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, delay: 30 * 24 * 60 * 60 * 1000 /* 30 days */ },
    );
    return {
      jobId: job.id,
      message: 'Solicitação de exclusão registrada. Seus dados serão apagados em 30 dias. Você pode reverter esta ação antes desse prazo.',
      processAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  // ─── Export Data Sync (preview) ──────────────────────────────────────────

  async exportDataSync(orgId: string) {
    const [contatos, cp, cr, logs] = await Promise.all([
      this.contatosRepo.find({ where: { orgId } }),
      this.cpRepo.find({ where: { orgId }, take: 1000 }),
      this.crRepo.find({ where: { orgId }, take: 1000 }),
      this.auditRepo.find({ where: { orgId }, take: 1000, order: { createdAt: 'DESC' } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      orgId,
      summary: {
        contatos: contatos.length,
        contasPagar: cp.length,
        contasReceber: cr.length,
        auditLogs: logs.length,
      },
      data: { contatos, contasPagar: cp, contasReceber: cr, auditLogs: logs },
    };
  }

  // ─── Audit Log (user's own, last 90 days) ───────────────────────────────

  async getMyAuditLog(userId: string, orgId: string, page = 1, limit = 50) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.org_id = :orgId', { orgId })
      .andWhere('a.created_at > :since', { since })
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ─── Consents ────────────────────────────────────────────────────────────

  async getConsents(userId: string) {
    const consents = await this.consentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const types: ConsentType[] = ['cookies_essenciais', 'analytics', 'marketing', 'ai_processing'];
    const result: Record<string, { accepted: boolean; updatedAt: string | null }> = {};

    for (const type of types) {
      const latest = consents.find((c) => c.type === type);
      result[type] = {
        accepted: latest?.accepted ?? (type === 'cookies_essenciais'), // essenciais sempre aceitos
        updatedAt: latest?.createdAt?.toISOString() ?? null,
      };
    }

    return result;
  }

  async recordConsent(
    userId: string,
    type: ConsentType,
    accepted: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consent = this.consentRepo.create({
      userId,
      type,
      accepted,
      ipAddress,
      userAgent,
      version: '1.0',
    });
    await this.consentRepo.save(consent);
    return { type, accepted, recordedAt: consent.createdAt };
  }

  // ─── DPO Request ─────────────────────────────────────────────────────────

  async createDpoRequest(payload: {
    name: string;
    email: string;
    cpf?: string;
    tipo: string;
    descricao: string;
    ipAddress?: string;
  }) {
    // Enqueue for processing and notification
    const job = await this.lgpdQueue.add(
      'dpo-request',
      { ...payload, requestedAt: new Date().toISOString() },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      jobId: job.id,
      protocolNumber: `DPO-${Date.now()}`,
      message: 'Sua solicitação foi registrada. Responderemos em até 15 dias úteis conforme LGPD Art. 18.',
      email: payload.email,
    };
  }
}
