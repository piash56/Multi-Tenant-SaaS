import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service.js";
import {
  CurrentTenant,
  CurrentUser,
  RequirePermissions,
  RequirePlatformPermissions,
} from "./auth.decorators.js";
import type { AuthenticatedPrincipal, TenantContext } from "./auth.types.js";

@ApiTags("authorization")
@ApiCookieAuth()
@ApiBearerAuth()
@Controller()
export class ProtectedController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("organizations/:organizationId/context")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Return the validated active organization context" })
  organizationContext(@CurrentTenant() tenant: TenantContext) {
    return { tenant };
  }

  @Get("organizations/:organizationId/conversations/:conversationId")
  @RequirePermissions("inbox.read")
  @ApiOperation({ summary: "Tenant-scoped resource lookup example" })
  async conversation(
    @CurrentTenant() tenant: TenantContext,
    @Param("conversationId") conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { organizationId_id: { organizationId: tenant.organizationId, id: conversationId } },
      select: { id: true, organizationId: true, status: true, currentAssigneeMembershipId: true },
    });
    if (!conversation) throw new NotFoundException("Resource not found");
    return { conversation };
  }

  @Get("platform/security-context")
  @RequirePlatformPermissions("platform.users.manage")
  @ApiOperation({ summary: "Protected platform-only authorization example" })
  platformContext(@CurrentUser() user: AuthenticatedPrincipal) {
    return { userId: user.userId, platformRole: user.platformRole };
  }
}
