#!/usr/bin/env node
/**
 * Usa `docker compose` (plugin) e cai para `docker-compose` (legado) se necessário.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  return r.status ?? 1;
}

let code = run('docker', ['compose', ...args]);
if (code !== 0) {
  code = run('docker-compose', args);
}
process.exit(code);
