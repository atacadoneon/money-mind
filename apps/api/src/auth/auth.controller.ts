import { Controller, Post, Body, ForbiddenException, UnauthorizedException, Logger, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from './decorators/public.decorator';
import { OrgMember } from './entities/org-member.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(OrgMember) private readonly members: Repository<OrgMember>,
  ) {}

  /**
   * Login endpoint — dual mode:
   * 1. Tries Supabase GoTrue (signInWithPassword) if SUPABASE_ANON_KEY is set
   * 2. Falls back to direct SQL bcrypt validation + self-signed JWT
   *
   * POST /api/v1/auth/login { email, password }
   */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    if (!email || !password) {
      throw new UnauthorizedException('Email e senha são obrigatórios');
    }

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');

    // Strategy 1: Supabase GoTrue (preferred)
    if (supabaseUrl && anonKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          const data = await res.json();
          const membership = await this.getMembershipFromDb(data.user?.id);

          return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            user: {
              id: data.user?.id,
              email: data.user?.email,
              name: data.user?.user_metadata?.name ?? email.split('@')[0],
            },
            org_id: membership?.org_id ?? null,
            role: membership?.role ?? null,
          };
        }
        this.logger.warn(`GoTrue login failed for ${email}, falling back to SQL`);
      } catch (e) {
        this.logger.warn(`GoTrue unreachable, falling back to SQL: ${e}`);
      }
    }

    // Strategy 2: Direct SQL bcrypt validation + self-signed JWT
    return this.loginViaSql(email, password);
  }

  /**
   * Validates password against auth.users bcrypt hash and issues a JWT.
   */
  private async loginViaSql(email: string, password: string) {
    const { Client } = await import('pg');
    const dbUrl = this.config.get<string>('DATABASE_URL') ?? '';
    const isRemote = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
    const client = new Client({
      connectionString: dbUrl,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
    });
    await client.connect();

    try {
      // Verify password using pgcrypto crypt()
      const userRes = await client.query(
        `SELECT id, email, raw_user_meta_data
         FROM auth.users
         WHERE email = $1
           AND encrypted_password = extensions.crypt($2, encrypted_password)`,
        [email, password],
      );

      if (!userRes.rows.length) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      const user = userRes.rows[0];
      const meta = user.raw_user_meta_data ?? {};

      // Update last_sign_in_at
      await client.query(
        'UPDATE auth.users SET last_sign_in_at = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id],
      ).catch(() => {/* non-critical */});

      const memberRes = await client.query(
        'SELECT org_id, role FROM org_members WHERE user_id = $1 LIMIT 1',
        [user.id],
      );
      const membership = memberRes.rows[0];

      const secret =
        this.config.get<string>('SUPABASE_JWT_SECRET') ||
        this.config.get<string>('JWT_SECRET') ||
        'dev-jwt-secret-money-mind-2026';

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          org_id: membership?.org_id ?? null,
          app_role: membership?.role ?? null,
        },
        secret,
        { expiresIn: '7d' },
      );

      this.logger.log(`SQL login OK: ${email} (${user.id})`);

      return {
        access_token: token,
        expires_in: 604800,
        user: {
          id: user.id,
          email: user.email,
          name: meta.name ?? email.split('@')[0],
        },
        org_id: membership?.org_id ?? null,
        role: membership?.role ?? null,
      };
    } finally {
      await client.end();
    }
  }

  /**
   * Helper: get org membership from DB.
   */
  private async getMembershipFromDb(userId: string): Promise<{ org_id: string; role: string } | null> {
    if (!userId) return null;
    const { Client } = await import('pg');
    const dbUrl = this.config.get<string>('DATABASE_URL') ?? '';
    const isRemote = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
    const client = new Client({
      connectionString: dbUrl,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
    });
    await client.connect();
    try {
      const res = await client.query(
        'SELECT org_id, role FROM org_members WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      return res.rows[0] ?? null;
    } finally {
      await client.end();
    }
  }

  @Public()
  @Post('dev-login')
  async devLogin(@Body() body: { email?: string }) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd) {
      throw new ForbiddenException('Dev login disabled in production');
    }

    const email = body.email || 'admin@moneymind.app';

    const { Client } = await import('pg');
    const client = new Client({ connectionString: this.config.get<string>('DATABASE_URL') });
    await client.connect();

    try {
      const userRes = await client.query(
        'SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = $1',
        [email],
      );

      if (!userRes.rows.length) {
        throw new ForbiddenException(`User ${email} not found`);
      }

      const user = userRes.rows[0];
      const meta = user.raw_user_meta_data ?? {};

      const memberRes = await client.query(
        'SELECT om.org_id, om.role FROM org_members om WHERE om.user_id = $1 LIMIT 1',
        [user.id],
      );

      const membership = memberRes.rows[0];

      const secret = this.config.get<string>('JWT_SECRET') || 'dev-jwt-secret-money-mind-2026';
      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: 'authenticated',
          aud: 'authenticated',
          org_id: membership?.org_id ?? null,
        },
        secret,
        { expiresIn: '30d' },
      );

      this.logger.log(`Dev login: ${email} (${user.id})`);

      return {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          name: meta.name ?? email.split('@')[0],
        },
        org_id: membership?.org_id ?? null,
        role: membership?.role ?? null,
      };
    } finally {
      await client.end();
    }
  }
}
