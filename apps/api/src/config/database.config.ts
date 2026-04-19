import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true',
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 20),
  logging: process.env.TYPEORM_LOGGING === 'true',
}));
