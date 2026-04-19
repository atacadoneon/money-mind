import { Controller, Post, Body, ForbiddenException, Logger } from '@nestjs/common';
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
