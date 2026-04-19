import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlansService } from '../plans.service';
import { Subscription, PlanSlug } from '../entities/subscription.entity';
import { PlanFeatures } from '../entities/plan.entity';

const PLAN_ORDER: PlanSlug[] = ['free', 'starter', 'pro', 'business', 'enterprise'];

export const REQUIRES_PLAN_KEY = 'requires_plan';
export const REQUIRES_FEATURE_KEY = 'requires_feature';

export const RequiresPlan = (plan: PlanSlug) => SetMetadata(REQUIRES_PLAN_KEY, plan);
export const RequiresFeature = (feature: keyof PlanFeatures) => SetMetadata(REQUIRES_FEATURE_KEY, feature);

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plansService: PlansService,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.get<PlanSlug>(REQUIRES_PLAN_KEY, ctx.getHandler());
    const requiredFeature = this.reflector.get<keyof PlanFeatures>(REQUIRES_FEATURE_KEY, ctx.getHandler());

    if (!requiredPlan && !requiredFeature) return true;

    const req = ctx.switchToHttp().getRequest();
    const orgId = req.orgContext?.orgId;
    if (!orgId) throw new ForbiddenException('Contexto de organização não encontrado');

    if (requiredFeature) {
      const has = await this.plansService.hasFeature(orgId, requiredFeature);
      if (!has) {
        throw new ForbiddenException(
          `Seu plano não inclui a funcionalidade '${requiredFeature}'. Faça upgrade para continuar.`,
        );
      }
    }

    if (requiredPlan) {
      const sub = await this.subRepo.findOne({ where: { orgId } }).catch(() => null);
      const currentPlan: PlanSlug = (sub?.plan as PlanSlug) ?? 'starter';

      const currentIdx = PLAN_ORDER.indexOf(currentPlan);
      const requiredIdx = PLAN_ORDER.indexOf(requiredPlan);

      if (currentIdx < requiredIdx) {
        throw new ForbiddenException(
          `Esta funcionalidade requer o plano '${requiredPlan}' ou superior. Seu plano atual é '${currentPlan}'.`,
        );
      }
    }

    return true;
  }
}
