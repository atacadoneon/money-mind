/**
 * Runner de migrations SQL para Supabase (pula stubs auth.*)
 * Uso: DATABASE_URL=... DATABASE_SSL=true npx tsx db/run-migrations-supabase.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrations] DATABASE_URL não definido');
  process.exit(1);
}

/** Remove comandos incompatíveis com Supabase managed schemas */
function sanitizeForSupabase(sql: string, filename: string): string {
  let result = sql;

  if (filename === '001_extensions.sql') {
    // Remove CREATE SCHEMA auth, CREATE TABLE auth.users, CREATE FUNCTION auth.uid()
    // Keep only extensions and set_updated_at()
    result = `
-- Extensions (Supabase-safe)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "btree_gin";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'btree_gin indisponível: %', SQLERRM;
END $$;
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Funções utilitárias
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
`;
  }

  // Remove qualquer CREATE SCHEMA IF NOT EXISTS auth
  result = result.replace(/CREATE SCHEMA IF NOT EXISTS auth;/gi, '-- [SKIPPED] auth schema managed by Supabase');

  // Remove CREATE TABLE IF NOT EXISTS auth.users (multiline)
  result = result.replace(
    /CREATE TABLE IF NOT EXISTS auth\.users\s*\([^)]*\);/gis,
    '-- [SKIPPED] auth.users managed by Supabase',
  );

  // Remove CREATE OR REPLACE FUNCTION auth.uid() (multiline, até $$;)
  result = result.replace(
    /CREATE OR REPLACE FUNCTION auth\.uid\(\)[\s\S]*?\$\$;/gi,
    '-- [SKIPPED] auth.uid() built-in on Supabase',
  );

  return result;
}

async function run(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('[migrations] Conectado ao Supabase');

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      run_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if ((already.rowCount ?? 0) > 0) {
      console.log(`[migrations] SKIP ${file} (já executada)`);
      continue;
    }

    const rawSql = readFileSync(join(migrationsDir, file), 'utf8');
    const sql = sanitizeForSupabase(rawSql, file);

    console.log(`[migrations] RUN  ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrations] OK   ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrations] FAIL ${file}`);
      console.error((err as Error).message ?? err);
      process.exit(1);
    }
  }

  await client.end();
  console.log('[migrations] ✓ Todas as migrations aplicadas no Supabase.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
