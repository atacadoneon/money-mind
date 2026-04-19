import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CobrancasBancariasService } from './cobrancas-bancarias.service';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

class CriarCobrancaDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaReceberId?: string;
  @ApiProperty() @IsNumber() valor!: number;
  @ApiProperty() @IsDateString() vencimento!: string;
  @ApiProperty() @IsString() sacadoNome!: string;
  @ApiProperty() @IsString() sacadoCpfCnpj!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
}

@ApiTags('cobrancas-bancarias')
@ApiBearerAuth()
@Controller('cobrancas-bancarias')
export class CobrancasBancariasController {
  constructor(private readonly svc: CobrancasBancariasService) {}

  @Get()
  @ApiOperation({ summary: 'Lista cobranças bancárias (boletos)' })
  list(
    @CurrentOrg() org: OrgContext,
    @Query() q: PaginationDto,
    @Query('company_id') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list(org.orgId, companyId, { ...q, status });
  }

  @Post()
  @ApiOperation({ summary: 'Gera boleto bancário (Sicoob ou pendente_geracao)' })
  criar(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Body() dto: CriarCobrancaDto,
  ) {
    return this.svc.criar(org.orgId, companyId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da cobrança com linha digitável, QR Pix, PDF URL' })
  getById(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.svc.getById(org.orgId, id);
  }

  @Post(':id/cancelar')
  @ApiOperation({ summary: 'Cancela/baixa boleto' })
  cancelar(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.svc.cancelar(org.orgId, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'URL para download do PDF do boleto' })
  getPdf(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.svc.getPdf(org.orgId, id);
  }
}
