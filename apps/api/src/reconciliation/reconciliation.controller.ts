import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { ConfirmMatchDto, IgnoreLinhaDto, RunBatchDto } from './dto/reconciliation.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('reconciliation') @ApiBearerAuth()
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly svc: ReconciliationService) {}

  @Get('stats') stats(@CurrentOrg() o: OrgContext) { return this.svc.stats(o.orgId); }

  @Get('suggestions/:linhaId')
  suggestions(@CurrentOrg() o: OrgContext, @Param('linhaId', ParseUUIDPipe) linhaId: string) {
    return this.svc.suggestionsForLinha(o.orgId, linhaId);
  }

  @Post('run-batch') @Roles('owner', 'admin', 'accountant')
  runBatch(@CurrentOrg() o: OrgContext, @Body() dto: RunBatchDto) { return this.svc.runBatch(o.orgId, dto.extratoId); }

  @Post('confirm') @Roles('owner', 'admin', 'accountant')
  confirm(@CurrentOrg() o: OrgContext, @Body() dto: ConfirmMatchDto) { return this.svc.confirm(o.orgId, dto); }

  @Post('ignore') @Roles('owner', 'admin', 'accountant')
  ignore(@CurrentOrg() o: OrgContext, @Body() dto: IgnoreLinhaDto) { return this.svc.ignore(o.orgId, dto); }

  @Post('ai-suggest/:linhaId') @Roles('owner', 'admin', 'accountant')
  askAi(@CurrentOrg() o: OrgContext, @Param('linhaId', ParseUUIDPipe) linhaId: string) {
    return this.svc.askAi(o.orgId, linhaId);
  }
}
