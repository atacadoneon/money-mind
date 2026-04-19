import type { Role } from '../enums/role.enum';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}
