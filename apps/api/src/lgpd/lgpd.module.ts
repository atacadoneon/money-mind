import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LgpdService } from './lgpd.service';
import { LgpdController } from './lgpd.controller';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { Contato } from '../contatos/entities/contato.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { Consent } from './entities/consent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContaPagar, ContaReceber, Contato, AuditLog, Consent]),
    BullModule.registerQueue({ name: 'lgpd' }),
  ],
  controllers: [LgpdController],
  providers: [LgpdService],
  exports: [LgpdService],
})
export class LgpdModule {}
