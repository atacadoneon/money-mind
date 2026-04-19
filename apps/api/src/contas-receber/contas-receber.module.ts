import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaReceber } from './entities/conta-receber.entity';
import { ContasReceberService } from './contas-receber.service';
import { ContasReceberController } from './contas-receber.controller';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContaReceber, AuditLog])],
  controllers: [ContasReceberController],
  providers: [ContasReceberService],
  exports: [ContasReceberService, TypeOrmModule],
})
export class ContasReceberModule {}
