import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY, // 32 bytes hex
}));
