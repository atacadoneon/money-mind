export const ROLES = ['owner', 'admin', 'accountant', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ACTOR_TYPES = ['user', 'system', 'ai', 'sync'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
