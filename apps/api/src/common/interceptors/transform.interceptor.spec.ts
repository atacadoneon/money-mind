import { ExecutionContext } from '@nestjs/common';
import { CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

const makeCtx = () => ({} as ExecutionContext);
const makeHandler = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  beforeEach(() => { interceptor = new TransformInterceptor(); });

  it('wraps plain value in { success, data }', async () => {
    const result = await firstValueFrom(interceptor.intercept(makeCtx(), makeHandler('hello')));
    expect(result).toEqual({ success: true, data: 'hello' });
  });

  it('wraps array in { success, data }', async () => {
    const result = await firstValueFrom(interceptor.intercept(makeCtx(), makeHandler([1, 2, 3])));
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });

  it('extracts data from { data, meta } payload', async () => {
    const payload = { data: [{ id: 1 }], meta: { total: 1, page: 1, limit: 25, totalPages: 1 } };
    const result = await firstValueFrom(interceptor.intercept(makeCtx(), makeHandler(payload)));
    expect(result).toEqual({ success: true, data: payload.data, meta: payload.meta, summary: undefined });
  });

  it('preserves summary field', async () => {
    const payload = { data: [], summary: { total: 0 } };
    const result = await firstValueFrom(interceptor.intercept(makeCtx(), makeHandler(payload)));
    expect(result).toEqual({ success: true, data: [], summary: { total: 0 }, meta: undefined });
  });

  it('wraps null as data null', async () => {
    const result = await firstValueFrom(interceptor.intercept(makeCtx(), makeHandler(null)));
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});
