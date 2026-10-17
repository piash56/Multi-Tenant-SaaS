import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser, RequirePlatformPermissions } from "../auth/auth.decorators.js";
import type { AuthenticatedPrincipal } from "../auth/auth.types.js";
import {
  AuditListQueryDto,
  CreateOrganizationDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
  UpdateUserStatusDto,
  UserListQueryDto,
} from "./admin.dto.js";
import { AdminService } from "./admin.service.js";

@ApiTags("platform administration")
@ApiExtraModels(
  AuditListQueryDto,
  CreateOrganizationDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
  UpdateUserStatusDto,
  UserListQueryDto,
)
@ApiCookieAuth()
@ApiBearerAuth()
@Controller("platform")
export class PlatformAdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("overview")
  @RequirePlatformPermissions("platform.organizations.manage")
  @ApiOperation({ summary: "Return safe platform administration metrics" })
  overview() {
    return this.admin.platformOverview();
  }

  @Get("organizations")
  @RequirePlatformPermissions("platform.organizations.manage")
  listOrganizations(@Query() query: OrganizationListQueryDto) {
    return this.admin.listOrganizations(query);
  }

  @Post("organizations")
  @RequirePlatformPermissions("platform.organizations.manage")
  createOrganization(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() input: CreateOrganizationDto,
    @Req() request: Request,
  ) {
    return this.admin.createOrganization(user, input, String(request.id));
  }

  @Get("organizations/:organizationId")
  @RequirePlatformPermissions("platform.organizations.manage")
  organization(@Param("organizationId") id: string) {
    return this.admin.organizationDetail(id);
  }

  @Patch("organizations/:organizationId")
  @RequirePlatformPermissions("platform.organizations.manage")
  updateOrganization(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param("organizationId") id: string,
    @Body() input: UpdateOrganizationDto,
    @Req() request: Request,
  ) {
    return this.admin.updatePlatformOrganization(user, id, input, String(request.id));
  }

  @Patch("organizations/:organizationId/status")
  @RequirePlatformPermissions("platform.organizations.manage")
  updateOrganizationStatus(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param("organizationId") id: string,
    @Body() input: UpdateOrganizationStatusDto,
    @Req() request: Request,
  ) {
    return this.admin.updateOrganizationStatus(user, id, input, String(request.id));
  }

  @Get("users")
  @RequirePlatformPermissions("platform.users.manage")
  listUsers(@Query() query: UserListQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get("users/:userId")
  @RequirePlatformPermissions("platform.users.manage")
  user(@Param("userId") id: string) {
    return this.admin.userDetail(id);
  }

  @Patch("users/:userId/status")
  @RequirePlatformPermissions("platform.users.manage")
  updateUserStatus(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param("userId") id: string,
    @Body() input: UpdateUserStatusDto,
    @Req() request: Request,
  ) {
    return this.admin.updateUserStatus(user, id, input, String(request.id));
  }

  @Get("audit-logs")
  @RequirePlatformPermissions("platform.audit.read")
  audit(@Query() query: AuditListQueryDto) {
    return this.admin.platformAudit(query);
  }
}
