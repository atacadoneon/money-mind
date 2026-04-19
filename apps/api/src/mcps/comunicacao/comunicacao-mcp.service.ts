import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComunicacaoLog } from './entities/comunicacao-log.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { Contato } from '../../contatos/entities/contato.entity';
import { GupshupClient } from './whatsapp/gupshup.client';
import { SendgridClient } from './email/sendgrid.client';
import { TwilioClient } from './sms/twilio.client';
import { CobrancaTemplateParams, cobrancaLembrete } from './templates/cobranca-lembrete';
import { cobrancaVencimento } from './templates/cobranca-vencimento';
import { cobrancaAtraso3d } from './templates/cobranca-atraso-3d';
import { cobrancaAtraso7d } from './templates/cobranca-atraso-7d';
import { cobrancaAtraso15d } from './templates/cobranca-atraso-15d';

export type CanalComunicacao = 'whatsapp' | 'email' | 'sms';

const TEMPLATES_MAP = {
  'cobranca-lembrete': cobrancaLembrete,
  'cobranca-vencimento': cobrancaVencimento,
  'cobranca-atraso-3d': cobrancaAtraso3d,
  'cobranca-atraso-7d': cobrancaAtraso7d,
  'cobranca-atraso-15d': cobrancaAtraso15d,
};

@Injectable()
export class ComunicacaoMcpService {
  private readonly logger = new Logger(ComunicacaoMcpService.name);

  constructor(
    @InjectRepository(ComunicacaoLog)
    private readonly logRepo: Repository<ComunicacaoLog>,
    @InjectRepository(ContaReceber)
    private readonly crRepo: Repository<ContaReceber>,
    @InjectRepository(Contato)
    private readonly contatosRepo: Repository<Contato>,
    private readonly gupshup: GupshupClient,
    private readonly sendgrid: SendgridClient,
    private readonly twilio: TwilioClient,
  ) {}

  async enviarCobranca(
    orgId: string,
    contaReceberId: string,
    canal: CanalComunicacao,
    templateKey: string,
  ) {
    const cr = await this.crRepo.findOne({ where: { id: contaReceberId, orgId } });
    if (!cr) throw new NotFoundException(`ContaReceber ${contaReceberId} not found`);

    let contato: Contato | null = null;
    if (cr.contatoId) {
      contato = await this.contatosRepo.findOne({ where: { id: cr.contatoId, orgId } });
    }

    const template = TEMPLATES_MAP[templateKey as keyof typeof TEMPLATES_MAP];
    if (!template) throw new NotFoundException(`Template '${templateKey}' não encontrado`);

    const params: CobrancaTemplateParams = {
      clienteNome: contato?.nome ?? 'Cliente',
      valor: Number(cr.valor).toFixed(2).replace('.', ','),
      vencimento: cr.dataVencimento,
      linkBoleto: (cr.rawData as Record<string, unknown>)?.linkBoleto as string | undefined,
    };

    let result: { status: string; messageId?: string; sid?: string; error?: string } = { status: 'error' };
    let destinatario = '';

    switch (canal) {
      case 'whatsapp': {
        const telefone = contato?.telefone ?? '';
        destinatario = telefone;
        result = await this.gupshup.sendTemplate(telefone, template.whatsappTemplateId, template.whatsappParams(params));
        break;
      }
      case 'email': {
        const email = contato?.email ?? '';
        destinatario = email;
        result = await this.sendgrid.send({
          to: email,
          subject: template.subject(params),
          html: template.html(params),
          text: template.text(params),
        });
        break;
      }
      case 'sms': {
        const telefone = contato?.telefone ?? '';
        destinatario = telefone;
        result = await this.twilio.sendSms(telefone, template.text(params));
        break;
      }
    }

    const log = await this.logRepo.save(
      this.logRepo.create({
        orgId,
        companyId: cr.companyId,
        contaReceberId,
        canal,
        template: templateKey,
        destinatario,
        status: result.status === 'sent' ? 'enviado' : 'falha',
        providerId: result.messageId ?? (result as Record<string, unknown>).sid as string ?? undefined,
        rawResponse: result as Record<string, unknown>,
        sentAt: result.status === 'sent' ? new Date() : undefined,
      }),
    );

    return { logId: log.id, status: log.status, canal, destinatario };
  }

  async listLogs(
    orgId: string,
    filters: { contaId?: string; canal?: string; status?: string; page?: number; limit?: number },
  ) {
    const qb = this.logRepo
      .createQueryBuilder('l')
      .where('l.org_id = :orgId', { orgId })
      .orderBy('l.created_at', 'DESC')
      .skip(((filters.page ?? 1) - 1) * (filters.limit ?? 50))
      .take(filters.limit ?? 50);

    if (filters.contaId) qb.andWhere('l.conta_receber_id = :cid', { cid: filters.contaId });
    if (filters.canal) qb.andWhere('l.canal = :canal', { canal: filters.canal });
    if (filters.status) qb.andWhere('l.status = :status', { status: filters.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page: filters.page ?? 1, limit: filters.limit ?? 50 };
  }
}
