import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthorizationService } from "./authorization.service.js";
import {
  CsrfGuard,
  AuthenticationGuard,
  PlatformAuthorizationGuard,
  TenantAuthorizationGuard,
  LoginRateLimitGuard,
} from "./guards.js";
import { OriginGuard } from "./origin.guard.js";
import { PasswordService } from "./password.service.js";
import { ProtectedController } from "./protected.controller.js";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.AUTH_JWT_SECRET!,
      signOptions: { algorithm: "HS256" },
      verifyOptions: { algorithms: ["HS256"] },
    }),
  ],
  controllers: [AuthController, ProtectedController],
  providers: [
    AuthService,
    PasswordService,
    AuthorizationService,
    LoginRateLimitGuard,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: TenantAuthorizationGuard },
    { provide: APP_GUARD, useClass: PlatformAuthorizationGuard },
  ],
  exports: [AuthService, AuthorizationService],
})
export class AuthModule {}
