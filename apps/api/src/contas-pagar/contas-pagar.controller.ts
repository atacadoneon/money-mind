import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ContasPagarService } from './contas-pagar.service';
import {
  BaixarContaDto, BulkBaixarDto, BulkIdsDto, BulkUpdateDto,
  CreateContaPagarDto, ImportColumnMapDto, ListContasPagarQuery, UpdateContaPagarDto,
} from './dto/contas-pagar.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('contas-pagar')
@ApiBearerAuth()
@Controller('contas-pagar')
export class ContasPagarController {
  constructor(private readonly svc: ContasPagarService) {}

  @Get()
  @ApiOperation({ summary: 'List contas a pagar with filters' })
  list(@CurrentOrg() o: OrgContext, @Query() q: ListContasPagarQuery) {
    return this.svc.list(o.orgId, q);
  }

  @Get('summary')
  summary(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.summary(o.orgId, companyId);
  }

  @Get('export.xlsx')
  @ApiOperation({ summary: 'Export contas a pagar as XLSX' })
  async exportXlsx(@CurrentOrg() o: OrgContext, @Query() q: ListContasPagarQuery, @Res() res: Response) {
    const buf = await this.svc.exportXlsx(o.orgId, q);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="contas_pagar.xlsx"');
    res.end(buf);
  }

  @Get(':id')
  async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(o.orgId, id) };
  }

  @Post()
  @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateContaPagarDto) {
    return { data: await this.svc.create(o.orgId, dto) };
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────────

  @Patch('bulk-update')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Bulk update multiple contas a pagar' })
  bulkUpdate(@CurrentOrg() o: OrgContext, @Body() dto: BulkUpdateDto) {
    return this.svc.bulkUpdate(o.orgId, dto);
  }

  @Post('bulk-delete')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Bulk soft-delete multiple contas a pagar' })
  bulkDelete(@CurrentOrg() o: OrgContext, @Body() dto: BulkIdsDto) {
    return this.svc.bulkDelete(o.orgId, dto);
  }

  @Post('bulk-baixar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Bulk baixar multiple contas a pagar' })
  bulkBaixar(@CurrentOrg() o: OrgContext, @Body() dto: BulkBaixarDto) {
    return this.svc.bulkBaixar(o.orgId, dto);
  }

  // ─── Import ────────────────────────────────────────────────────────────────────

  @Post('import/preview')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Preview import (sem gravar)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(
    @CurrentOrg() o: OrgContext,
    @Query('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() columnMap?: ImportColumnMapDto,
  ) {
    return this.svc.importPreview(o.orgId, companyId, file, columnMap);
  }

  @Post('import/:companyId')
  @Roles('owner', 'admin', 'accountant')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import contas a pagar from XLSX/CSV' })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @CurrentOrg() o: OrgContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() columnMap?: ImportColumnMapDto,
  ) {
    return this.svc.importFromFile(o.orgId, companyId, file, columnMap);
  }

  // ─── Individual CRUD ───────────────────────────────────────────────────────────

  @Post(':id/baixar')
  @Roles('owner', 'admin', 'accountant')
  async baixar(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BaixarContaDto,
  ) {
    return { data: await this.svc.baixar(o.orgId, id, dto) };
  }

  @Post(':id/estornar')
  @Roles('owner', 'admin', 'accountant')
  async estornar(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motivo') motivo?: string,
  ) {
    return { data: await this.svc.estornar(o.orgId, id, motivo) };
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'accountant')
  async update(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContaPagarDto,
  ) {
    return { data: await this.svc.update(o.orgId, id, dto) };
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(o.orgId, id);
  }
}
