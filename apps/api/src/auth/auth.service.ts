import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { OrgMember } from './entities/org-member.entity';

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  [k: string]: unknown;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(OrgMember) private readonly members: Repository<OrgMember>,
  ) {}

  verifyJwt(token: string): JwtPayload {
    const supaSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (supaSecret) {
      try {
        return jwt.verify(token, supaSecret) as JwtPayload;
      } catch {
        this.logger.warn('SUPABASE_JWT_SECRET verify failed');
      }
    }

    const devSecret = this.config.get<string>('JWT_SECRET');
    if (devSecret) {
      try {
        return jwt.verify(token, devSecret) as JwtPayload;
      } catch {
        this.logger.warn('JWT_SECRET verify failed — falling back to decode (DEV)');
      }
    }

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (!isProd) {
      const decoded = jwt.decode(token) as JwtPayload | null;
      if (decoded?.sub) {
        this.logger.warn('Accepting decoded (unverified) JWT in dev mode');
        return decoded;
      }
    }

    throw new Error('invalid payload');
  }

  async getMembership(userId: string, orgId: string): Promise<OrgMember | null> {
    return this.members.findOne({ where: { userId, orgId } });
  }
}
