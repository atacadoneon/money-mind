import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlcadaAprovacao } from './entities/alcada-aprovacao.entity';
import { AprovacaoPagamento } from './entities/aprovacao-pagamento.entity';
import { AprovacaoPagamentosService } from './aprovacao-pagamentos.service';
import { AprovacaoPagamentosController } from './aprovacao-pagamentos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AlcadaAprovacao, AprovacaoPagamento])],
  controllers: [AprovacaoPagamentosController],
  providers: [AprovacaoPagamentosService],
  exports: [AprovacaoPagamentosService, TypeOrmModule],
})
export class AprovacaoPagamentosModule {}
