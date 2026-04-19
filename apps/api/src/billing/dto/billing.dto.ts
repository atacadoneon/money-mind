import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['starter', 'pro', 'business', 'enterprise'] })
  @IsEnum(['starter', 'pro', 'business', 'enterprise'])
  plan!: 'starter' | 'pro' | 'business' | 'enterprise';

  @ApiPropertyOptional({ description: 'Ciclo de cobrança: monthly ou yearly' })
  @IsOptional()
  @IsEnum(['monthly', 'yearly'])
  cycle?: 'monthly' | 'yearly';
}

export class ApplyCouponDto {
  @ApiProperty({ description: 'Código do cupom Stripe' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class WebhookHeaderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  'stripe-signature'!: string;
}
