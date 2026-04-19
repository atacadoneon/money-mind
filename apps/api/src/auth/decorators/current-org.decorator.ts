import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface OrgContext {
  orgId: string;
  role: string;
  userId: string;
}

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): OrgContext => {
  const req = ctx.switchToHttp().getRequest();
  return req.orgContext;
});
