# Observability — MONEY MIND

> Setup de **logs estruturados + traces + métricas + error reporting**. Este documento é guia — a implementação concreta está em `apps/api/src/observability/` (Agente 2).

---

## Pilares

| Pilar | Ferramenta | Onde |
|---|---|---|
| Logs | Pino (JSON) + Render/Vercel logs + (opcional) Loki | stdout |
| Traces | OpenTelemetry + OTLP exporter → Sentry / Grafana | api + worker |
| Métricas | `/metrics` Prometheus (opcional MVP) | api |
| Errors | Sentry (@sentry/node, @sentry/nextjs) | api + web |

---

## 1. Logger Pino (api)

```ts
// apps/api/src/observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.api_key',
      '*.cpf',
      '*.cnpj',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({
      service: 'money-mind-api',
      env: process.env.NODE_ENV,
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

Integração Nest:

```ts
// main.ts
import { LoggerModule } from 'nestjs-pino';
// ...
app.useLogger(app.get(Logger));
```

Todo request log deve incluir `tenant_id`, `user_id`, `request_id` (UUID gerado pelo middleware).

---

## 2. OpenTelemetry (traces)

```ts
// apps/api/src/observability/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export const otel = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'money-mind-api',
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.NODE_ENV ?? 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? Object.fromEntries(
          process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map((kv) => kv.split('=')),
        )
      : undefined,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

// chamar otel.start() antes de importar o Nest
```

Habilitar com: `OTEL_EXPORTER_OTLP_ENDPOINT=...` + `OTEL_EXPORTER_OTLP_HEADERS=...` nas envs.

### Spans manuais críticos

- `reconciliation.match` (inclui `tenant_id`, `transaction_count`)
- `integration.tiny.call` (inclui `endpoint`, `status_code`)
- `queue.job.<name>` (inclui `attempts`, `duration_ms`)

---

## 3. Sentry (errors)

```ts
// apps/api/src/observability/sentry.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.RENDER_GIT_COMMIT,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  beforeSend(event) {
    // remover dados sensíveis caso escapem do redact do Pino
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

Enriquecer com contexto por request:

```ts
Sentry.withScope((scope) => {
  scope.setTag('tenant_id', tenantId);
  scope.setUser({ id: userId });
  // handler
});
```

Sentry Next.js: seguir `npx @sentry/wizard@latest -i nextjs`.

---

## 4. Métricas Prometheus (opcional MVP)

Endpoint `/metrics` com:

- `http_requests_total{method, route, status_code}`
- `http_request_duration_seconds_bucket{...}` (histogram)
- `db_pool_connections{state}`
- `bullmq_jobs_total{queue, status}`
- `bullmq_queue_waiting{queue}` (gauge)

Pacote sugerido: `prom-client` + Nest controller dedicado.

Scrape: Grafana Cloud free tier ou Prometheus self-hosted.

---

## 5. Health endpoints

| Endpoint | O que verifica |
|---|---|
| `GET /health` | 200 sempre (liveness) |
| `GET /health/ready` | DB + Redis respondendo (readiness) |
| `GET /health/deep` | + integra externas (usado manualmente) |

---

## 6. Request ID + Correlation

- Middleware gera `X-Request-Id` (UUID) se ausente
- Log inclui em todos os eventos
- Propagado para chamadas de integração externa no header `X-Request-Id`

---

## 7. Log sampling em prod

- `info` default
- `debug` só se `DEBUG=1` (caso operador investigando)
- Evitar loops logando — use sampling em eventos de alta cardinalidade

---

## 8. Dashboards sugeridos (Grafana / Sentry)

### Dash "API Health"

- RPS por rota
- Latência p50/p95/p99
- 5xx rate
- DB pool utilization
- Top 5 slowest endpoints

### Dash "Business"

- Tenants ativos
- Jobs BullMQ por status
- Imports OFX por dia
- Conciliações pendentes

---

## 9. Variáveis de env relacionadas

```
LOG_LEVEL=info
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_SERVICE_NAME=money-mind-api
```

---

## 10. Pós-MVP

- Logs agregados em Loki/Better Stack
- Tracing sampling dinâmico
- Synthetic tests (Checkly) para fluxos críticos
- RUM no web (Sentry Session Replay — cuidado com PII)
