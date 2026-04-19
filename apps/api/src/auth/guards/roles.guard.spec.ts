import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { OrgRole } from '../entities/org-member.entity';

const makeCtx = (role: OrgRole | undefined) => {
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ orgContext: role ? { role } : undefined }) }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
  return ctx;
};

describe('RolesGuard', () => {
  it('passes when no roles required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeCtx('viewer');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when empty roles array', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('viewer'))).toBe(true);
  });

  it('throws ForbiddenException when no orgContext', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin'] as OrgRole[]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when role not in required list', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['owner', 'admin'] as OrgRole[]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx('viewer'))).toThrow(ForbiddenException);
  });

  it('passes when role is in required list', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'accountant'] as OrgRole[]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('admin'))).toBe(true);
  });

  it('passes owner role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['owner'] as OrgRole[]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx('owner'))).toBe(true);
  });
});
