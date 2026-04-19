import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormaPagamento } from './entities/forma-pagamento.entity';
import { FormasPagamentoService } from './formas-pagamento.service';
import { FormasPagamentoController } from './formas-pagamento.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FormaPagamento])],
  controllers: [FormasPagamentoController],
  providers: [FormasPagamentoService],
  exports: [FormasPagamentoService, TypeOrmModule],
})
export class FormasPagamentoModule {}
