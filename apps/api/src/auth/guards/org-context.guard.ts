import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY, SKIP_ORG_KEY } from '../decorators/public.decorator';

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ORG_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest();
    const orgId = req.headers['x-org-id'];
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('Missing x-org-id header');
    }

    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('No authenticated user');

    const membership = await this.auth.getMembership(userId, orgId);
    if (!membership) throw new ForbiddenException('User is not a member of this organization');

    req.orgContext = { orgId, role: membership.role, userId };
    return true;
  }
}
