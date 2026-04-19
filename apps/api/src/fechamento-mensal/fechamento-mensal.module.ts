import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FechamentoMensal } from './entities/fechamento-mensal.entity';
import { FechamentoChecklistItem } from './entities/fechamento-checklist-item.entity';
import { FechamentoMensalService } from './fechamento-mensal.service';
import { FechamentoMensalController } from './fechamento-mensal.controller';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FechamentoMensal, FechamentoChecklistItem, AuditLog])],
  controllers: [FechamentoMensalController],
  providers: [FechamentoMensalService],
  exports: [FechamentoMensalService, TypeOrmModule],
})
export class FechamentoMensalModule {}
