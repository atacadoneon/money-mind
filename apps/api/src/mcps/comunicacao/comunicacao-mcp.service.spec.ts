import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ComunicacaoMcpService } from './comunicacao-mcp.service';
import { ComunicacaoLog } from './entities/comunicacao-log.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { Contato } from '../../contatos/entities/contato.entity';
import { GupshupClient } from './whatsapp/gupshup.client';
import { SendgridClient } from './email/sendgrid.client';
import { TwilioClient } from './sms/twilio.client';

describe('ComunicacaoMcpService', () => {
  let service: ComunicacaoMcpService;

  const mockCR: Partial<ContaReceber> = {
    id: 'cr-uuid',
    orgId: 'org-uuid',
    companyId: 'company-uuid',
    valor: '500',
    dataVencimento: '2024-02-15',
    situacao: 'aberto',
    historico: 'Fatura #001',
  };

  const mockLog = {
    id: 'log-uuid',
    canal: 'email',
    status: 'enviado',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComunicacaoMcpService,
        {
          provide: getRepositoryToken(ComunicacaoLog),
          useValue: {
            create: jest.fn().mockReturnValue(mockLog),
            save: jest.fn().mockResolvedValue(mockLog),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
          },
        },
        {
          provide: getRepositoryToken(ContaReceber),
          useValue: { findOne: jest.fn().mockResolvedValue(mockCR) },
        },
        {
          provide: getRepositoryToken(Contato),
          useValue: { findOne: jest.fn().mockResolvedValue({ nome: 'João', email: 'joao@test.com', telefone: '+5511999999999' }) },
        },
        {
          provide: GupshupClient,
          useValue: { sendTemplate: jest.fn().mockResolvedValue({ status: 'sent', messageId: 'msg-1' }) },
        },
        {
          provide: SendgridClient,
          useValue: { send: jest.fn().mockResolvedValue({ status: 'sent', messageId: 'sg-1' }) },
        },
        {
          provide: TwilioClient,
          useValue: { sendSms: jest.fn().mockResolvedValue({ status: 'sent', sid: 'SM1' }) },
        },
      ],
    }).compile();

    service = module.get<ComunicacaoMcpService>(ComunicacaoMcpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException for unknown template', async () => {
    await expect(
      service.enviarCobranca('org-uuid', 'cr-uuid', 'email', 'template-inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return list logs with pagination', async () => {
    const result = await service.listLogs('org-uuid', {});
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
  });
});
