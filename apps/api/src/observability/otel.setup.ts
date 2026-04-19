/**
 * OpenTelemetry setup — stub funcional.
 * Ativa quando OTEL_ENABLED=true e OTEL_EXPORTER_OTLP_ENDPOINT configurado.
 *
 * Instalar quando habilitar:
 *   pnpm --filter api add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
 */

export function setupOtel(): void {
  const enabled = process.env.OTEL_ENABLED === 'true';
  if (!enabled) {
    console.log('[OTel] OTEL_ENABLED=false — skipping OpenTelemetry initialization');
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    console.warn('[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — skipping');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-pg': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
        }),
      ],
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'money-mind-api',
    });

    sdk.start();
    console.log(`[OTel] Initialized — exporting to ${endpoint}`);

    process.on('SIGTERM', () => {
      sdk.shutdown().catch(console.error);
    });
  } catch {
    console.warn('[OTel] @opentelemetry packages not installed — skipping');
  }
}
