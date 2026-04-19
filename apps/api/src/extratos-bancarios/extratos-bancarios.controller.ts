import {
  Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ExtratosBancariosService } from './extratos-bancarios.service';
import { ListExtratosQuery, UploadOfxQueryDto } from './dto/extrato.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('extratos-bancarios') @ApiBearerAuth()
@Controller('extratos-bancarios')
export class ExtratosBancariosController {
  constructor(private readonly svc: ExtratosBancariosService) {}

  @Get() list(@CurrentOrg() o: OrgContext, @Query() q: ListExtratosQuery) { return this.svc.listExtratos(o.orgId, q); }
  @Get(':id') async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return { data: await this.svc.getExtrato(o.orgId, id) }; }
  @Get(':id/linhas') linhas(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query() q: PaginationDto, @Query('status') status?: string) {
    return this.svc.listLinhas(o.orgId, id, { ...q, status });
  }

  @Post('upload-ofx') @Roles('owner', 'admin', 'accountant')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentOrg() o: OrgContext, @Body() body: UploadOfxQueryDto, @UploadedFile() file: Express.Multer.File) {
    return this.svc.uploadOfx({ orgId: o.orgId, companyId: body.companyId, contaBancariaId: body.contaBancariaId, file });
  }
}
