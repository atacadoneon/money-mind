import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlansService } from './plans.service';
import { StripeClient } from './stripe.client';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Plan } from './entities/plan.entity';
import { FeatureFlagsUsage } from './entities/feature-flags-usage.entity';
import { PlanGuard } from './guards/plan.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Invoice, Plan, FeatureFlagsUsage]),
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    PlansService,
    StripeClient,
    PlanGuard,
  ],
  exports: [BillingService, PlansService, StripeClient, PlanGuard],
})
export class BillingModule {}
