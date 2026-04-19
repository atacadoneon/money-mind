/**
 * db/reset.ts
 * DROP de todas as tabelas públicas. USO APENAS EM DEV.
 */
import { config } from 'dotenv';
import { Client } from 'pg';

config();

if (process.env.NODE_ENV === 'production') {
  console.error('[reset] NODE_ENV=production — abortado.');
  process.exit(1);
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  console.log('[reset] Dropando schema public e recriando...');
  await client.query(`DROP SCHEMA IF EXISTS public CASCADE;`);
  await client.query(`CREATE SCHEMA public;`);
  await client.query(`GRANT ALL ON SCHEMA public TO public;`);
  console.log('[reset] OK. Rode pnpm db:migrate em seguida.');

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
