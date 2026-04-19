/**
 * Validação síncrona de variáveis críticas antes do bootstrap Nest.
 * Deve rodar após carregar `.env` da raiz do monorepo (ver main.ts).
 */
export function validateProcessEnv(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('[env] DATABASE_URL é obrigatório para subir a API.');
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'production') return;

  const missing: string[] = [];
  if (!process.env.SUPABASE_URL?.trim()) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_JWT_SECRET?.trim()) missing.push('SUPABASE_JWT_SECRET');
  if (missing.length) {
    throw new Error(`[env] Em produção, defina: ${missing.join(', ')}`);
  }

  const enc = process.env.ENCRYPTION_KEY?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(enc)) {
    throw new Error('[env] ENCRYPTION_KEY em produção deve ter exatamente 64 caracteres hex (32 bytes). Gere com: openssl rand -hex 32');
  }

  const cors = process.env.CORS_ORIGIN?.trim();
  if (!cors || cors === '*') {
    throw new Error('[env] CORS_ORIGIN em produção deve ser uma lista explícita de origens (não use *).');
  }
}
