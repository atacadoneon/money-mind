import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthService } from '../auth.service';

const makeCtx = (headers: Record<string, string>, isPublic = false) => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const auth = { verifyJwt: jest.fn() } as unknown as AuthService;
  const req = { headers, user: null as unknown };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
  return { reflector, auth, ctx, req };
};

describe('SupabaseAuthGuard', () => {
  it('passes public routes without token', async () => {
    const { reflector, auth, ctx } = makeCtx({}, true);
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws UnauthorizedException when no Authorization header', async () => {
    const { reflector, auth, ctx } = makeCtx({});
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on invalid bearer format', async () => {
    const { reflector, auth, ctx } = makeCtx({ authorization: 'Basic abc' });
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('sets req.user and returns true with valid token', async () => {
    const { reflector, auth, ctx, req } = makeCtx({ authorization: 'Bearer valid-token' });
    (auth.verifyJwt as jest.Mock).mockReturnValue({ sub: 'user-1', email: 'x@x.com' });
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ sub: 'user-1', email: 'x@x.com' });
  });

  it('throws UnauthorizedException when verifyJwt throws', async () => {
    const { reflector, auth, ctx } = makeCtx({ authorization: 'Bearer bad-token' });
    (auth.verifyJwt as jest.Mock).mockImplementation(() => { throw new Error('expired'); });
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when payload has no sub', async () => {
    const { reflector, auth, ctx } = makeCtx({ authorization: 'Bearer tok' });
    (auth.verifyJwt as jest.Mock).mockReturnValue({ email: 'x@x.com' }); // no sub
    const guard = new SupabaseAuthGuard(reflector, auth);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
