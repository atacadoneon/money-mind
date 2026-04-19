import { ExecutionContext } from '@nestjs/common';
import { CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditLogInterceptor } from '../../audit-log/audit-log.interceptor';
import { AuditLogService } from '../../audit-log/audit-log.service';

const makeCtx = (method: string, url: string, orgId?: string, userId?: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      url,
      orgContext: orgId ? { orgId, role: 'admin', userId: userId ?? 'user-1' } : null,
      user: userId ? { sub: userId } : null,
      ip: '127.0.0.1',
    }),
  }),
} as unknown as ExecutionContext);

const makeHandler = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let audit: { log: jest.Mock };

  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue({}) };
    interceptor = new AuditLogInterceptor(audit as unknown as AuditLogService);
  });

  it('does not log GET requests', (done) => {
    const ctx = makeCtx('GET', '/api/v1/contas-pagar', 'org-1', 'user-1');
    interceptor.intercept(ctx, makeHandler({ data: [] })).subscribe({
      complete: () => {
        setTimeout(() => { expect(audit.log).not.toHaveBeenCalled(); done(); }, 10);
      },
    });
  });

  it('logs POST create action', (done) => {
    const ctx = makeCtx('POST', '/api/v1/contas-pagar', 'org-1', 'user-1');
    interceptor.intercept(ctx, makeHandler({ data: { id: 'cp-1', valor: '100' } })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entity: 'contas-pagar' }));
          done();
        }, 10);
      },
    });
  });

  it('logs PATCH update action', (done) => {
    const ctx = makeCtx('PATCH', '/api/v1/companies/co-1', 'org-1', 'user-1');
    interceptor.intercept(ctx, makeHandler({ data: { id: 'co-1' } })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
          done();
        }, 10);
      },
    });
  });

  it('logs DELETE remove action', (done) => {
    const ctx = makeCtx('DELETE', '/api/v1/contatos/ct-1', 'org-1', 'user-1');
    interceptor.intercept(ctx, makeHandler({ data: { id: 'ct-1' } })).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
          done();
        }, 10);
      },
    });
  });

  it('skips logging when no orgContext', (done) => {
    const ctx = makeCtx('POST', '/api/v1/auth/login'); // no orgId
    interceptor.intercept(ctx, makeHandler({ data: {} })).subscribe({
      complete: () => {
        setTimeout(() => { expect(audit.log).not.toHaveBeenCalled(); done(); }, 10);
      },
    });
  });
});
