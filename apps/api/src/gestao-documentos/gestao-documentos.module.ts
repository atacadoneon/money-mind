import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Documento } from './entities/documento.entity';
import { GestaoDocumentosService } from './gestao-documentos.service';
import { GestaoDocumentosController } from './gestao-documentos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Documento])],
  controllers: [GestaoDocumentosController],
  providers: [GestaoDocumentosService],
  exports: [GestaoDocumentosService, TypeOrmModule],
})
export class GestaoDocumentosModule {}
