import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.request.js";
import type { AuthenticatedPrincipal, Permission, TenantContext } from "./auth.types.js";

export const IS_PUBLIC_KEY = "auth:is-public";
export const PERMISSIONS_KEY = "auth:permissions";
export const PLATFORM_PERMISSIONS_KEY = "auth:platform-permissions";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...required: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, required);
export const RequirePlatformPermissions = (...required: Permission[]) =>
  SetMetadata(PLATFORM_PERMISSIONS_KEY, required);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth,
);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().tenant,
);
