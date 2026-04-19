export const PLANS = ['starter', 'pro', 'business', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];
