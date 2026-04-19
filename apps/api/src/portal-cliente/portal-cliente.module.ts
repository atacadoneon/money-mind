import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalSessao } from './entities/portal-sessao.entity';
import { PortalPendencia } from './entities/portal-pendencia.entity';
import { PortalMensagem } from './entities/portal-mensagem.entity';
import { PortalClienteService } from './portal-cliente.service';
import { PortalClienteController } from './portal-cliente.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PortalSessao, PortalPendencia, PortalMensagem])],
  controllers: [PortalClienteController],
  providers: [PortalClienteService],
  exports: [PortalClienteService, TypeOrmModule],
})
export class PortalClienteModule {}
