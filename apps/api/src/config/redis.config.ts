import { registerAs } from '@nestjs/config';

function parseRedisUrl(url: string | undefined): { host: string; port: number; password?: string; db: number } | null {
  const raw = url?.trim();
  if (!raw?.startsWith('redis://') && !raw?.startsWith('rediss://')) return null;
  try {
    const normalized = raw.replace(/^rediss:\/\//, 'https://').replace(/^redis:\/\//, 'http://');
    const u = new URL(normalized);
    const pathDb = u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0;
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number(u.port) : 6379,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      db: Number.isFinite(pathDb) ? pathDb : 0,
    };
  } catch {
    return null;
  }
}

export const redisConfig = registerAs('redis', () => {
  const fromUrl = parseRedisUrl(process.env.REDIS_URL);
  if (fromUrl) return fromUrl;
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  };
});
