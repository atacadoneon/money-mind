import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';

const METHOD_TO_ACTION: Record<string, 'create' | 'update' | 'delete' | 'bulk'> = {
  POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete',
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((resp) => {
        const orgId = req.orgContext?.orgId;
        if (!orgId) return;
        const action = METHOD_TO_ACTION[req.method];
        if (!action) return;
        const url: string = req.url ?? '';
        const entityType = url.split('/')[3] ?? 'unknown';
        const entityId = (resp as { data?: { id?: string } })?.data?.id ?? null;
        void this.audit.log({
          orgId, actorId: req.user?.sub ?? null, action, entityType, entityId,
          changes: (resp as { data?: unknown })?.data as Record<string, unknown> ?? {},
        }).catch(() => undefined);
      }),
    );
  }
}
