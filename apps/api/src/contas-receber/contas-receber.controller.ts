import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ContasReceberService } from './contas-receber.service';
import {
  BaixarReceberDto, BulkBaixarCRDto, BulkCRIdsDto, BulkCRUpdateDto,
  CreateContaReceberDto, ImportCRColumnMapDto, ListContasReceberQuery, UpdateContaReceberDto,
} from './dto/contas-receber.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('contas-receber')
@ApiBearerAuth()
@Controller('contas-receber')
export class ContasReceberController {
  constructor(private readonly svc: ContasReceberService) {}

  @Get()
  list(@CurrentOrg() o: OrgContext, @Query() q: ListContasReceberQuery) {
    return this.svc.list(o.orgId, q);
  }

  @Get('summary')
  summary(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.summary(o.orgId, companyId);
  }

  @Get('export.xlsx')
  @ApiOperation({ summary: 'Export contas a receber as XLSX' })
  async exportXlsx(@CurrentOrg() o: OrgContext, @Query() q: ListContasReceberQuery, @Res() res: Response) {
    const buf = await this.svc.exportXlsx(o.orgId, q);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="contas_receber.xlsx"');
    res.end(buf);
  }

  @Get(':id')
  async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(o.orgId, id) };
  }

  @Post()
  @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateContaReceberDto) {
    return { data: await this.svc.create(o.orgId, dto) };
  }

  @Patch('bulk-update')
  @Roles('owner', 'admin', 'accountant')
  bulkUpdate(@CurrentOrg() o: OrgContext, @Body() dto: BulkCRUpdateDto) {
    return this.svc.bulkUpdate(o.orgId, dto);
  }

  @Post('bulk-delete')
  @Roles('owner', 'admin')
  bulkDelete(@CurrentOrg() o: OrgContext, @Body() dto: BulkCRIdsDto) {
    return this.svc.bulkDelete(o.orgId, dto);
  }

  @Post('bulk-baixar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Bulk baixar contas a receber' })
  bulkBaixar(@CurrentOrg() o: OrgContext, @Body() dto: BulkBaixarCRDto) {
    return this.svc.bulkBaixar(o.orgId, dto);
  }

  @Post('import/preview')
  @Roles('owner', 'admin', 'accountant')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(
    @CurrentOrg() o: OrgContext,
    @Query('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() columnMap?: ImportCRColumnMapDto,
  ) {
    return this.svc.importPreview(o.orgId, companyId, file, columnMap);
  }

  @Post('import/:companyId')
  @Roles('owner', 'admin', 'accountant')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @CurrentOrg() o: OrgContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() columnMap?: ImportCRColumnMapDto,
  ) {
    return this.svc.importFromFile(o.orgId, companyId, file, columnMap);
  }

  @Post(':id/baixar')
  @Roles('owner', 'admin', 'accountant')
  async baixar(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BaixarReceberDto) {
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
  async update(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContaReceberDto) {
    return { data: await this.svc.update(o.orgId, id, dto) };
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(o.orgId, id);
  }
}
