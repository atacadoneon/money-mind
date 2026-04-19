/**
 * Runner de migrations SQL (fonte única: db/migrations/*.sql).
 * Uso: pnpm db:migrate | pnpm db:migrate -- --dry-run | DRY_RUN=true pnpm db:migrate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';
import { Client } from 'pg';

config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrations] DATABASE_URL não definido no .env');
  process.exit(1);
}

const dryRun =
  process.argv.includes('--dry-run') ||
  process.env.DRY_RUN === 'true' ||
  process.env.DRY_RUN === '1';

async function run(): Promise<void> {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

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

  const pending: string[] = [];
  for (const file of files) {
    const already = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if ((already.rowCount ?? 0) > 0) continue;
    pending.push(file);
  }

  if (dryRun) {
    if (pending.length === 0) {
      console.log('[migrations] DRY-RUN: nenhuma migration pendente.');
    } else {
      console.log('[migrations] DRY-RUN: migrations que seriam aplicadas:');
      for (const f of pending) console.log(`  - ${f}`);
    }
    await client.end();
    return;
  }

  for (const file of files) {
    const already = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if ((already.rowCount ?? 0) > 0) {
      console.log(`[migrations] SKIP ${file} (já executada)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
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
      console.error(err);
      process.exit(1);
    }
  }

  await client.end();
  console.log('[migrations] Todas as migrations aplicadas.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
