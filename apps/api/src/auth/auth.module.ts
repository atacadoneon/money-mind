import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { OrgContextGuard } from './guards/org-context.guard';
import { RolesGuard } from './guards/roles.guard';
import { OrgMember } from './entities/org-member.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([OrgMember])],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseAuthGuard,
    OrgContextGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: OrgContextGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, SupabaseAuthGuard, OrgContextGuard, RolesGuard, TypeOrmModule],
})
export class AuthModule {}
