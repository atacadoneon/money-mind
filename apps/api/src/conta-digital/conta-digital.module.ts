import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaDigitalService } from './conta-digital.service';
import { ContaDigitalController } from './conta-digital.controller';
import { ContaBancaria } from '../contas-bancarias/entities/conta-bancaria.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContaBancaria, ExtratoLinha, ContaPagar, ContaReceber])],
  controllers: [ContaDigitalController],
  providers: [ContaDigitalService],
  exports: [ContaDigitalService],
})
export class ContaDigitalModule {}
