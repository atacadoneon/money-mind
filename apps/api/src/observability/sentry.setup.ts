/**
 * Sentry setup — @sentry/node v8+
 * Inicializar ANTES do NestJS bootstrapping em main.ts.
 */

const PII_PATTERNS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,            // CPF
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,     // CNPJ
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi, // email
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,           // Bearer token
  /"password"\s*:\s*"[^"]*"/gi,                  // password field
];

function redactPii(str: string): string {
  let s = str;
  for (const pat of PII_PATTERNS) s = s.replace(pat, '[REDACTED]');
  return s;
}

export function setupSentry(dsn: string, environment: string): void {
  if (!dsn) {
    console.warn('[Sentry] DSN not configured — skipping Sentry initialization');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as typeof import('@sentry/node');

    // Try to load profiling integration if available
    let profilingIntegration: unknown[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { nodeProfilingIntegration } = require('@sentry/profiling-node');
      profilingIntegration = [nodeProfilingIntegration()];
    } catch {
      // profiling-node optional
    }

    // Determine release from package.json
    let release: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require('../../../package.json') as { version?: string };
      release = pkg.version ? `money-mind-api@${pkg.version}` : undefined;
    } catch {
      // package.json not found in some build envs
    }

    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: environment === 'production' ? 0.05 : 0.1,
      integrations: [...profilingIntegration] as never,

      // Ignore noisy health check transactions
      ignoreTransactions: ['/health', '/health/live', '/health/ready', '/health/deep', '/metrics'],

      // Redact PII from events before sending to Sentry
      beforeSend(event) {
        // Redact request body
        if (event.request?.data && typeof event.request.data === 'string') {
          event.request.data = redactPii(event.request.data);
        }
        // Redact Authorization header
        if (event.request?.headers?.['Authorization']) {
          event.request.headers['Authorization'] = '[REDACTED]';
        }
        if (event.request?.headers?.['authorization']) {
          event.request.headers['authorization'] = '[REDACTED]';
        }
        // Redact any exception messages containing PII
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = redactPii(ex.value);
          }
        }
        return event;
      },
    });

    console.log(`[Sentry] Initialized — env: ${environment}, release: ${release ?? 'unknown'}`);
  } catch {
    console.warn('[Sentry] @sentry/node not installed — skipping');
  }
}

export function setupNestSentry(app: unknown): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as Record<string, unknown>;
    const handler = Sentry['setupNestErrorHandler'];
    if (typeof handler === 'function') {
      (handler as (app: unknown) => void)(app);
      console.log('[Sentry] NestJS error handler registered');
    }
  } catch {
    // older sentry version — not critical
  }
}
