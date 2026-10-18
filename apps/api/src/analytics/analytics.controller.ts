import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentTenant, RequirePermissions } from "../auth/auth.decorators.js";
import type { TenantContext } from "../auth/auth.types.js";
import { AnalyticsQueryDto } from "./analytics.dto.js";
import { AnalyticsService } from "./analytics.service.js";

@ApiTags("moderator analytics")
@ApiExtraModels(AnalyticsQueryDto)
@ApiCookieAuth()
@ApiBearerAuth()
@Controller("organizations/:organizationId/analytics")
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get()
  @RequirePermissions("analytics.self")
  @ApiOperation({ summary: "Return role-scoped moderator analytics and leaderboard" })
  overview(@CurrentTenant() tenant: TenantContext, @Query() query: AnalyticsQueryDto) {
    return this.analytics.overview(tenant, query);
  }

  @Get("moderators/:membershipId")
  @RequirePermissions("analytics.self")
  @ApiOperation({ summary: "Return an authorized moderator performance detail" })
  detail(
    @CurrentTenant() tenant: TenantContext,
    @Param("membershipId") membershipId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.detail(tenant, membershipId, query);
  }
}
