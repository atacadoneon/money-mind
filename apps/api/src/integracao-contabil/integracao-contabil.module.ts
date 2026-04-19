import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportacaoContabil } from './entities/exportacao-contabil.entity';
import { ProvisaoImposto } from './entities/provisao-imposto.entity';
import { IntegracaoContabilService } from './integracao-contabil.service';
import { IntegracaoContabilController } from './integracao-contabil.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExportacaoContabil, ProvisaoImposto])],
  controllers: [IntegracaoContabilController],
  providers: [IntegracaoContabilService],
  exports: [IntegracaoContabilService, TypeOrmModule],
})
export class IntegracaoContabilModule {}
