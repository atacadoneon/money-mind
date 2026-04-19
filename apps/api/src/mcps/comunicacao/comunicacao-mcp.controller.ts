import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComunicacaoMcpService, CanalComunicacao } from './comunicacao-mcp.service';
import { CurrentOrg, OrgContext } from '../../auth/decorators/current-org.decorator';

class EnviarCobrancaDto {
  @ApiProperty() @IsUUID() contaReceberId!: string;
  @ApiProperty({ enum: ['whatsapp', 'email', 'sms'] }) @IsEnum(['whatsapp', 'email', 'sms']) canal!: CanalComunicacao;
  @ApiProperty({ example: 'cobranca-lembrete' }) @IsString() template!: string;
}

@ApiTags('mcps/comunicacao')
@ApiBearerAuth()
@Controller('mcps/comunicacao')
export class ComunicacaoMcpController {
  constructor(private readonly svc: ComunicacaoMcpService) {}

  @Post('cobranca')
  @ApiOperation({ summary: 'Envia cobrança via canal escolhido (WhatsApp, Email, SMS)' })
  enviarCobranca(@CurrentOrg() org: OrgContext, @Body() dto: EnviarCobrancaDto) {
    return this.svc.enviarCobranca(org.orgId, dto.contaReceberId, dto.canal, dto.template);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Lista logs de comunicações enviadas' })
  listLogs(
    @CurrentOrg() org: OrgContext,
    @Query('conta_id') contaId?: string,
    @Query('canal') canal?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.listLogs(org.orgId, { contaId, canal, status, page: Number(page ?? 1), limit: Number(limit ?? 50) });
  }
}
