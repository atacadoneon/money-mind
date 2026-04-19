import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaixaService } from './caixa.service';
import { CaixaController } from './caixa.controller';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContaPagar, ContaReceber])],
  controllers: [CaixaController],
  providers: [CaixaService],
  exports: [CaixaService],
})
export class CaixaModule {}
