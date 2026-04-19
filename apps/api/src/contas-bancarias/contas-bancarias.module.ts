import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaBancaria } from './entities/conta-bancaria.entity';
import { ContasBancariasService } from './contas-bancarias.service';
import { ContasBancariasController } from './contas-bancarias.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContaBancaria])],
  controllers: [ContasBancariasController],
  providers: [ContasBancariasService],
  exports: [ContasBancariasService, TypeOrmModule],
})
export class ContasBancariasModule {}
