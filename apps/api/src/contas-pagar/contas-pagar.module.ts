import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaPagar } from './entities/conta-pagar.entity';
import { ContasPagarService } from './contas-pagar.service';
import { ContasPagarController } from './contas-pagar.controller';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContaPagar, AuditLog])],
  controllers: [ContasPagarController],
  providers: [ContasPagarService],
  exports: [ContasPagarService, TypeOrmModule],
})
export class ContasPagarModule {}
