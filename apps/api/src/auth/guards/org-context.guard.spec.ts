import { Reflector } from '@nestjs/core';
import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrgContextGuard } from './org-context.guard';
import { AuthService } from '../auth.service';
import { OrgMember } from '../entities/org-member.entity';

const makeCtx = (opts: {
  headers?: Record<string, string>;
  user?: { sub: string };
  isPublic?: boolean;
  skipOrg?: boolean;
}) => {
  const { headers = {}, user = { sub: 'user-1' }, isPublic = false, skipOrg = false } = opts;
  const reflector = {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === 'isPublic') return isPublic;
      if (key === 'skipOrgContext') return skipOrg;
      return false;
    }),
  } as unknown as Reflector;
  const auth = { getMembership: jest.fn() } as unknown as AuthService;
  const req = { headers, user, orgContext: null as unknown };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
  return { reflector, auth, ctx, req };
};

describe('OrgContextGuard', () => {
  it('passes public routes', async () => {
    const { reflector, auth, ctx } = makeCtx({ isPublic: true });
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('passes skipOrg routes', async () => {
    const { reflector, auth, ctx } = makeCtx({ skipOrg: true });
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws BadRequestException when x-org-id missing', async () => {
    const { reflector, auth, ctx } = makeCtx({ headers: {} });
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when user is missing', async () => {
    const { reflector, auth, ctx } = makeCtx({ headers: { 'x-org-id': 'org-1' }, user: undefined as never });
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when not a member', async () => {
    const { reflector, auth, ctx } = makeCtx({ headers: { 'x-org-id': 'org-1' } });
    (auth.getMembership as jest.Mock).mockResolvedValue(null);
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('sets orgContext and returns true for valid member', async () => {
    const { reflector, auth, ctx, req } = makeCtx({ headers: { 'x-org-id': 'org-1' } });
    const membership = { userId: 'user-1', orgId: 'org-1', role: 'admin' } as OrgMember;
    (auth.getMembership as jest.Mock).mockResolvedValue(membership);
    const guard = new OrgContextGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.orgContext).toEqual({ orgId: 'org-1', role: 'admin', userId: 'user-1' });
  });
});
