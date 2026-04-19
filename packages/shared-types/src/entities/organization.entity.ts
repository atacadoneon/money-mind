import type { Plan } from '../enums/plan.enum';
import type { BaseEntity } from './base.entity';

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color: string;
  plan: Plan;
  settings: Record<string, unknown>;
}
