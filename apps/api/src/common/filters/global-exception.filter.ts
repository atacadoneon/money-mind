import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      message = typeof r === 'string' ? r : (r as { message?: string }).message ?? r;
      code = (r as { code?: string }).code ?? exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name;
    }

    if (status >= 500) {
      this.logger.error(`[${req.method}] ${req.url} -> ${status} ${code}`, (exception as Error)?.stack);
    } else {
      this.logger.warn(`[${req.method}] ${req.url} -> ${status} ${code}`);
    }

    res.status(status).json({
      success: false,
      error: { code, message, timestamp: new Date().toISOString(), path: req.url },
    });
  }
}
