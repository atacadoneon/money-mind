import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '../entities/org-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
