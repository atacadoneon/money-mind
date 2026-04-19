import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditLogService } from './audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('audit-log') @ApiBearerAuth()
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Lista logs de auditoria com filtros' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  list(
    @CurrentOrg() o: OrgContext,
    @Query() q: PaginationDto,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.svc.list(o.orgId, { ...q, entityType, entityId });
  }

  @Get('export.xlsx')
  @Roles('owner', 'admin')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Exporta logs de auditoria em formato JSON (LGPD compliance)' })
  async exportXlsx(@CurrentOrg() o: OrgContext, @Res() res: Response) {
    const result = await this.svc.list(o.orgId, { page: 1, limit: 5000 });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.json"`);
    res.json({ exportedAt: new Date().toISOString(), total: result.meta.total, data: result.data });
  }
}
