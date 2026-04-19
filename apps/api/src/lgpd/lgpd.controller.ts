import { Controller, Get, Post, Body, Req, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { IsString, IsBoolean, IsEnum, IsOptional, IsEmail, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Request } from 'express';
import { LgpdService } from './lgpd.service';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { ConsentType } from './entities/consent.entity';

class ConsentDto {
  @ApiProperty({ enum: ['cookies_essenciais', 'analytics', 'marketing', 'ai_processing'] })
  @IsEnum(['cookies_essenciais', 'analytics', 'marketing', 'ai_processing'])
  type!: ConsentType;

  @ApiProperty()
  @IsBoolean()
  accepted!: boolean;
}

class DpoRequestDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({ enum: ['acesso', 'correcao', 'anonimizacao', 'portabilidade', 'eliminacao', 'revogacao_consentimento'] })
  @IsIn(['acesso', 'correcao', 'anonimizacao', 'portabilidade', 'eliminacao', 'revogacao_consentimento'])
  tipo!: string;

  @ApiProperty()
  @IsString()
  descricao!: string;
}

@ApiTags('lgpd')
@Controller('lgpd')
export class LgpdController {
  constructor(private readonly svc: LgpdService) {}

  // ─── Export ───────────────────────────────────────────────────────────────

  @Post('export-request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'LGPD Art. 18 — solicita exportação completa dos dados do usuário' })
  requestExport(@CurrentOrg() org: OrgContext) {
    return this.svc.requestExport(org.userId, org.orgId);
  }

  // ─── Erasure ──────────────────────────────────────────────────────────────

  @Post('erasure-request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'LGPD Art. 18 — solicita exclusão/anonimização dos dados (30 dias de reversão)' })
  requestErasure(@CurrentOrg() org: OrgContext) {
    return this.svc.requestErasure(org.userId, org.orgId);
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────

  @Get('audit/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna audit log do usuário corrente (últimos 90 dias)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMyAuditLog(
    @CurrentOrg() org: OrgContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getMyAuditLog(org.userId, org.orgId, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  @Get('export-preview')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview dos dados exportáveis (sem PII no log)' })
  exportPreview(@CurrentOrg() org: OrgContext) {
    return this.svc.exportDataSync(org.orgId);
  }

  // ─── Consents ─────────────────────────────────────────────────────────────

  @Get('consent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna consentimentos ativos do usuário' })
  getConsents(@CurrentOrg() org: OrgContext) {
    return this.svc.getConsents(org.userId);
  }

  @Post('consent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registra consentimento granular (cookies, marketing, analytics, IA)' })
  recordConsent(
    @CurrentOrg() org: OrgContext,
    @Body() dto: ConsentDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.headers['x-forwarded-for'] as string;
    const ua = req.headers['user-agent'];
    return this.svc.recordConsent(org.userId, dto.type, dto.accepted, ip, ua);
  }

  // ─── DPO Contact ──────────────────────────────────────────────────────────

  @Post('dpo-request')
  @ApiOperation({ summary: 'Envia solicitação ao DPO (público, sem auth necessária)' })
  dpoRequest(@Body() dto: DpoRequestDto, @Req() req: Request) {
    const ip = req.ip ?? req.headers['x-forwarded-for'] as string;
    return this.svc.createDpoRequest({ ...dto, ipAddress: ip });
  }
}
