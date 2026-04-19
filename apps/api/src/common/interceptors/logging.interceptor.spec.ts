import { ExecutionContext } from '@nestjs/common';
import { CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const makeCtx = (method = 'GET', url = '/api/test') => ({
  switchToHttp: () => ({ getRequest: () => ({ method, url }) }),
} as unknown as ExecutionContext);

const makeHandler = (value: unknown = { data: 'ok' }): CallHandler => ({
  handle: () => of(value),
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  beforeEach(() => { interceptor = new LoggingInterceptor(); });

  it('should pass through response unchanged', (done) => {
    const ctx = makeCtx();
    const handler = makeHandler({ data: 'result' });
    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ data: 'result' });
        done();
      },
    });
  });

  it('should complete without error', (done) => {
    const ctx = makeCtx('POST', '/api/v1/contas-pagar');
    const handler = makeHandler(null);
    interceptor.intercept(ctx, handler).subscribe({
      complete: () => done(),
      error: done,
    });
  });

  it('should handle multiple requests independently', (done) => {
    const ctx1 = makeCtx('GET', '/health');
    const ctx2 = makeCtx('POST', '/companies');
    const handler1 = makeHandler('a');
    const handler2 = makeHandler('b');
    let count = 0;
    const check = () => { count++; if (count === 2) done(); };
    interceptor.intercept(ctx1, handler1).subscribe({ complete: check });
    interceptor.intercept(ctx2, handler2).subscribe({ complete: check });
  });
});
