import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanFeatures } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { FeatureFlagsUsage } from './entities/feature-flags-usage.entity';

const DEFAULT_PLANS: Array<Omit<Plan, 'id' | 'createdAt'>> = [
  {
    slug: 'free',
    name: 'Free',
    priceBrl: 0,
    billingCycle: 'monthly',
    trialDays: 0,
    active: true,
    features: {
      max_empresas: 1,
      max_transacoes_mes: 100,
      mcps_ativos: [],
      ai_enabled: false,
      relatorios_avancados: false,
      suporte_prioritario: false,
      api_access: false,
      trial_days: 0,
    },
    stripePriceId: undefined,
  },
  {
    slug: 'starter',
    name: 'Starter',
    priceBrl: 49,
    billingCycle: 'monthly',
    trialDays: 14,
    active: true,
    features: {
      max_empresas: 3,
      max_transacoes_mes: 5000,
      mcps_ativos: ['tiny'],
      ai_enabled: false,
      relatorios_avancados: false,
      suporte_prioritario: false,
      api_access: false,
      trial_days: 14,
    },
    stripePriceId: undefined,
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceBrl: 149,
    billingCycle: 'monthly',
    trialDays: 14,
    active: true,
    features: {
      max_empresas: 10,
      max_transacoes_mes: 30000,
      mcps_ativos: ['tiny', 'bancos'],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: false,
      api_access: false,
      trial_days: 14,
    },
    stripePriceId: undefined,
  },
  {
    slug: 'business',
    name: 'Business',
    priceBrl: 449,
    billingCycle: 'monthly',
    trialDays: 14,
    active: true,
    features: {
      max_empresas: 999,
      max_transacoes_mes: 999999,
      mcps_ativos: ['tiny', 'bancos', 'gateways', 'comunicacao'],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: true,
      api_access: true,
      trial_days: 14,
    },
    stripePriceId: undefined,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceBrl: 0,
    billingCycle: 'monthly',
    trialDays: 30,
    active: true,
    features: {
      max_empresas: 999,
      max_transacoes_mes: 999999,
      mcps_ativos: ['tiny', 'bancos', 'gateways', 'comunicacao'],
      ai_enabled: true,
      relatorios_avancados: true,
      suporte_prioritario: true,
      api_access: true,
      trial_days: 30,
    },
    stripePriceId: undefined,
  },
];

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  // In-memory fallback if DB table not yet seeded
  private readonly memPlans = DEFAULT_PLANS;

  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(FeatureFlagsUsage) private readonly usageRepo: Repository<FeatureFlagsUsage>,
  ) {}

  async getAllPlans(): Promise<Plan[]> {
    try {
      const plans = await this.planRepo.find({ where: { active: true }, order: { priceBrl: 'ASC' } });
      if (plans.length > 0) return plans;
    } catch (err) {
      this.logger.warn('plans table not found, using in-memory defaults');
    }
    return this.memPlans as Plan[];
  }

  async getPlanBySlug(slug: string): Promise<Plan | null> {
    try {
      const p = await this.planRepo.findOne({ where: { slug, active: true } });
      if (p) return p;
    } catch {
      // fallback
    }
    return (this.memPlans.find((p) => p.slug === slug) as Plan) ?? null;
  }

  async getFeaturesForOrg(orgId: string): Promise<PlanFeatures> {
    try {
      const sub = await this.subRepo.findOne({ where: { orgId } });
      if (sub) {
        const plan = await this.getPlanBySlug(sub.plan);
        if (plan) return plan.features;
      }
    } catch {
      // fallback
    }
    return DEFAULT_PLANS[1].features; // starter defaults
  }

  async hasFeature(orgId: string, feature: keyof PlanFeatures): Promise<boolean> {
    const features = await this.getFeaturesForOrg(orgId);
    const value = features[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (Array.isArray(value)) return value.length > 0;
    return false;
  }

  async checkUsage(orgId: string, metric: string): Promise<{ used: number; limit: number; allowed: boolean }> {
    const features = await this.getFeaturesForOrg(orgId);
    let limit = 0;

    if (metric === 'empresas') limit = features.max_empresas;
    else if (metric === 'transacoes_mes') limit = features.max_transacoes_mes;

    let usage: FeatureFlagsUsage | null = null;
    try {
      usage = await this.usageRepo.findOne({
        where: { orgId, featureSlug: metric },
        order: { createdAt: 'DESC' },
      });
    } catch {
      // ignore
    }

    const used = usage?.usedCount ?? 0;
    return { used, limit, allowed: limit === 0 || limit === 999999 || used < limit };
  }

  async incrementUsage(orgId: string, metric: string, amount = 1): Promise<void> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      let usage = await this.usageRepo.findOne({ where: { orgId, featureSlug: metric } });
      if (!usage) {
        usage = this.usageRepo.create({ orgId, featureSlug: metric, usedCount: 0, periodStart, periodEnd });
      }
      usage.usedCount += amount;
      await this.usageRepo.save(usage);
    } catch (err) {
      this.logger.warn(`Failed to increment usage for org ${orgId}: ${err}`);
    }
  }
}
