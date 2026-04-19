import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { validateProcessEnv } from './config/validate-env';

loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env.local'), override: true });
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { setupSentry, setupNestSentry } from './observability/sentry.setup';
import { setupOtel } from './observability/otel.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  validateProcessEnv();

  // Initialize OpenTelemetry FIRST (before any other require loads)
  setupOtel();

  // Initialize Sentry before NestJS bootstrap
  setupSentry(
    process.env.SENTRY_DSN ?? '',
    process.env.NODE_ENV ?? 'development',
  );

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true,
  });

  // Register Sentry NestJS error handler
  setupNestSentry(app);

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // Security headers — strict in prod
  app.use(helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
  }));
  app.use(compression());

  // CORS — whitelist via env in prod
  const rawOrigins = config.get<string>('CORS_ORIGIN', '*');
  const origins = rawOrigins === '*' ? '*' : rawOrigins.split(',').map((s) => s.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: [
      'x-org-id',
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
    ],
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'docs'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MONEY MIND API')
    .setDescription('BPO Financeiro — backend NestJS')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-org-id', in: 'header' }, 'x-org-id')
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('API_PORT', 3333);
  await app.listen(port);
  logger.log(`MONEY MIND API running at http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap', err);
  process.exit(1);
});
