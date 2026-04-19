import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface StandardResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  summary?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
          const p = payload as { data: T; meta?: Record<string, unknown>; summary?: Record<string, unknown> };
          return { success: true, data: p.data, meta: p.meta, summary: p.summary };
        }
        return { success: true, data: payload as T };
      }),
    );
  }
}
