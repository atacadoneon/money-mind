import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contato } from './entities/contato.entity';
import { ContatosService } from './contatos.service';
import { ContatosController } from './contatos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Contato])],
  controllers: [ContatosController],
  providers: [ContatosService],
  exports: [ContatosService, TypeOrmModule],
})
export class ContatosModule {}
