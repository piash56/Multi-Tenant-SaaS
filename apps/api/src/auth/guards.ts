import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../database/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { AuthService } from "./auth.service.js";
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, PLATFORM_PERMISSIONS_KEY } from "./auth.decorators.js";
import type { AuthenticatedRequest } from "./auth.request.js";
import type { Permission } from "./auth.types.js";
import { AuthorizationService } from "./authorization.service.js";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.authService.getAccessToken(request);
    if (!token) throw new UnauthorizedException("Authentication required");
    request.auth = await this.authService.authenticate(token);
    return true;
  }
}

@Injectable()
export class TenantAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuthorizationService)
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw new UnauthorizedException("Authentication required");
    const rawOrganizationId = request.params.organizationId;
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;
    if (!organizationId) throw new ForbiddenException("Organization context required");
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId: request.auth.userId },
      include: { organization: true },
    });
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      membership.organization.status !== "ACTIVE"
    ) {
      throw new NotFoundException("Resource not found");
    }
    const permissions = this.authorization.forRole(membership.role);
    if (!this.authorization.hasAll(permissions, required))
      throw new ForbiddenException("Forbidden");
    request.tenant = {
      ...request.auth,
      organizationId,
      membershipId: membership.id,
      membershipRole: membership.role,
      permissions,
    };
    return true;
  }
}

@Injectable()
export class PlatformAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw new UnauthorizedException("Authentication required");
    if (request.auth.platformRole !== "SUPER_ADMIN") {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: request.auth.userId,
          action: "authorization.platform",
          targetType: "PERMISSION",
          targetId: required.join(","),
          result: "DENIED",
          requestId: request.id ?? null,
        },
      });
      throw new ForbiddenException("Forbidden");
    }
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
    const hasCookieCredential = Boolean(
      request.cookies?.saas_access || request.cookies?.saas_refresh,
    );
    if (!hasCookieCredential) return true;
    if (!this.authService.validCsrf(request))
      throw new ForbiddenException("CSRF validation failed");
    return true;
  }
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const email =
      typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown";
    const key = `rate:auth:login:${Buffer.from(email).toString("base64url")}`;
    if (this.redis.client.status === "wait") await this.redis.client.connect();
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 60);
    if (count > 5)
      throw new HttpException("Too many authentication attempts", HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
