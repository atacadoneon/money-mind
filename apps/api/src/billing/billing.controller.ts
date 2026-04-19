import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { PlansService } from './plans.service';
import { CreateCheckoutDto, ApplyCouponDto } from './dto/billing.dto';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { StripeClient } from './stripe.client';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly plansService: PlansService,
    private readonly stripeClient: StripeClient,
  ) {}

  // ─── Checkout ─────────────────────────────────────────────────────────────

  @Post('checkout')
  @ApiBearerAuth()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Cria Stripe Checkout Session para assinatura' })
  @ApiResponse({ status: 201, description: 'URL do Stripe Checkout' })
  createCheckout(
    @CurrentOrg() org: OrgContext,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession(org.orgId, dto.plan, dto.cycle ?? 'monthly');
  }

  // ─── Customer Portal ──────────────────────────────────────────────────────

  @Post('portal')
  @ApiBearerAuth()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Cria Stripe Customer Portal Session' })
  @ApiResponse({ status: 201, description: 'URL do portal de gerenciamento' })
  createPortal(@CurrentOrg() org: OrgContext) {
    return this.billingService.createCustomerPortalSession(org.orgId);
  }

  // ─── Webhook (público, sem auth) ─────────────────────────────────────────

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (público, valida assinatura)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body not available');
    if (!signature) throw new BadRequestException('Missing stripe-signature header');

    let event;
    try {
      event = this.stripeClient.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err}`);
    }

    await this.billingService.handleWebhook(event);
    return { received: true };
  }

  // ─── Get Subscription ─────────────────────────────────────────────────────

  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna assinatura atual e faturas' })
  @ApiResponse({ status: 200, description: 'Detalhes da assinatura' })
  getSubscription(@CurrentOrg() org: OrgContext) {
    return this.billingService.getCurrentSubscription(org.orgId);
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────

  @Post('cancel')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Cancela assinatura ao final do período atual' })
  cancelSubscription(@CurrentOrg() org: OrgContext) {
    return this.billingService.cancelSubscription(org.orgId);
  }

  // ─── Apply Coupon ─────────────────────────────────────────────────────────

  @Post('apply-coupon')
  @ApiBearerAuth()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Aplica cupom de desconto na assinatura' })
  applyCoupon(
    @CurrentOrg() org: OrgContext,
    @Body() dto: ApplyCouponDto,
  ) {
    return this.billingService.applyCoupon(org.orgId, dto.code);
  }

  // ─── Get Plans ────────────────────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'Lista todos os planos disponíveis' })
  async getPlans() {
    const plans = await this.plansService.getAllPlans();
    return { plans };
  }
}
