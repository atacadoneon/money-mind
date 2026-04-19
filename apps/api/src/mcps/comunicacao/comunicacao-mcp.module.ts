import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GupshupClient } from './whatsapp/gupshup.client';
import { SendgridClient } from './email/sendgrid.client';
import { TwilioClient } from './sms/twilio.client';
import { ComunicacaoMcpService } from './comunicacao-mcp.service';
import { ComunicacaoMcpController } from './comunicacao-mcp.controller';
import { ComunicacaoLog } from './entities/comunicacao-log.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { Contato } from '../../contatos/entities/contato.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComunicacaoLog, ContaReceber, Contato]),
    BullModule.registerQueue({ name: 'cobranca-regua' }),
  ],
  controllers: [ComunicacaoMcpController],
  providers: [GupshupClient, SendgridClient, TwilioClient, ComunicacaoMcpService],
  exports: [ComunicacaoMcpService],
})
export class ComunicacaoMcpModule {}
