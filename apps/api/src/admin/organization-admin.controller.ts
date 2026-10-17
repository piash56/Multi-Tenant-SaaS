import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentTenant, CurrentUser, Public, RequirePermissions } from "../auth/auth.decorators.js";
import type { AuthenticatedPrincipal, TenantContext } from "../auth/auth.types.js";
import {
  AcceptInvitationDto,
  AuditListQueryDto,
  CreateInvitationDto,
  CreateTeamDto,
  InvitationListQueryDto,
  MemberListQueryDto,
  RegisterInvitationDto,
  TeamListQueryDto,
  TeamMemberDto,
  UpdateMembershipDto,
  UpdateOrganizationDto,
  UpdateTeamDto,
} from "./admin.dto.js";
import { AdminService } from "./admin.service.js";
import { AdminMutationRateLimitGuard } from "./admin-rate-limit.guard.js";

@ApiTags("organization administration")
@ApiExtraModels(
  AcceptInvitationDto,
  AuditListQueryDto,
  CreateInvitationDto,
  CreateTeamDto,
  InvitationListQueryDto,
  MemberListQueryDto,
  RegisterInvitationDto,
  TeamListQueryDto,
  TeamMemberDto,
  UpdateMembershipDto,
  UpdateOrganizationDto,
  UpdateTeamDto,
)
@ApiCookieAuth()
@ApiBearerAuth()
@Controller()
export class OrganizationAdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get("organizations/:organizationId/overview")
  @RequirePermissions("organization.read")
  overview(@CurrentTenant() tenant: TenantContext) {
    return this.admin.tenantOverview(tenant);
  }

  @Patch("organizations/:organizationId/settings")
  @RequirePermissions("organization.update")
  updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: UpdateOrganizationDto,
    @Req() request: Request,
  ) {
    return this.admin.updateTenantOrganization(tenant, input, String(request.id));
  }

  @Get("organizations/:organizationId/members")
  @RequirePermissions("members.read")
  members(@CurrentTenant() tenant: TenantContext, @Query() query: MemberListQueryDto) {
    return this.admin.listMembers(tenant, query);
  }

  @Patch("organizations/:organizationId/members/:membershipId")
  @RequirePermissions("members.manage")
  updateMember(
    @CurrentTenant() tenant: TenantContext,
    @Param("membershipId") id: string,
    @Body() input: UpdateMembershipDto,
    @Req() request: Request,
  ) {
    return this.admin.updateMembership(tenant, id, input, String(request.id));
  }

  @Get("organizations/:organizationId/teams")
  @RequirePermissions("members.read")
  teams(@CurrentTenant() tenant: TenantContext, @Query() query: TeamListQueryDto) {
    return this.admin.listTeams(tenant, query);
  }

  @Post("organizations/:organizationId/teams")
  @RequirePermissions("members.manage")
  createTeam(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: CreateTeamDto,
    @Req() request: Request,
  ) {
    return this.admin.createTeam(tenant, input, String(request.id));
  }

  @Get("organizations/:organizationId/teams/:teamId")
  @RequirePermissions("members.read")
  team(@CurrentTenant() tenant: TenantContext, @Param("teamId") id: string) {
    return this.admin.teamDetail(tenant, id);
  }

  @Patch("organizations/:organizationId/teams/:teamId")
  @RequirePermissions("members.manage")
  updateTeam(
    @CurrentTenant() tenant: TenantContext,
    @Param("teamId") id: string,
    @Body() input: UpdateTeamDto,
    @Req() request: Request,
  ) {
    return this.admin.updateTeam(tenant, id, input, String(request.id));
  }

  @Post("organizations/:organizationId/teams/:teamId/members")
  @RequirePermissions("members.manage")
  addTeamMember(
    @CurrentTenant() tenant: TenantContext,
    @Param("teamId") teamId: string,
    @Body() input: TeamMemberDto,
    @Req() request: Request,
  ) {
    return this.admin.addTeamMember(tenant, teamId, input.membershipId, String(request.id));
  }

  @Delete("organizations/:organizationId/teams/:teamId/members/:membershipId")
  @HttpCode(204)
  @RequirePermissions("members.manage")
  removeTeamMember(
    @CurrentTenant() tenant: TenantContext,
    @Param("teamId") teamId: string,
    @Param("membershipId") membershipId: string,
    @Req() request: Request,
  ) {
    return this.admin.removeTeamMember(tenant, teamId, membershipId, String(request.id));
  }

  @Get("organizations/:organizationId/invitations")
  @RequirePermissions("invitations.manage")
  invitations(@CurrentTenant() tenant: TenantContext, @Query() query: InvitationListQueryDto) {
    return this.admin.listInvitations(tenant, query);
  }

  @Post("organizations/:organizationId/invitations")
  @UseGuards(AdminMutationRateLimitGuard)
  @RequirePermissions("invitations.manage")
  createInvitation(
    @CurrentTenant() tenant: TenantContext,
    @Body() input: CreateInvitationDto,
    @Req() request: Request,
  ) {
    return this.admin.createInvitation(tenant, input, String(request.id));
  }

  @Post("organizations/:organizationId/invitations/:invitationId/revoke")
  @UseGuards(AdminMutationRateLimitGuard)
  @RequirePermissions("invitations.manage")
  revokeInvitation(
    @CurrentTenant() tenant: TenantContext,
    @Param("invitationId") id: string,
    @Req() request: Request,
  ) {
    return this.admin.revokeInvitation(tenant, id, String(request.id));
  }

  @Post("invitations/accept")
  @UseGuards(AdminMutationRateLimitGuard)
  @ApiOperation({ summary: "Accept an invitation for the authenticated account" })
  acceptInvitation(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() input: AcceptInvitationDto,
    @Req() request: Request,
  ) {
    return this.admin.acceptInvitation(user, input.token, String(request.id));
  }

  @Public()
  @Post("invitations/register")
  @UseGuards(AdminMutationRateLimitGuard)
  @ApiOperation({ summary: "Create an invitation-only account and accept its invitation" })
  registerInvitation(@Body() input: RegisterInvitationDto, @Req() request: Request) {
    return this.admin.registerInvitation(input, String(request.id));
  }

  @Get("organizations/:organizationId/audit-logs")
  @RequirePermissions("audit.read")
  audit(@CurrentTenant() tenant: TenantContext, @Query() query: AuditListQueryDto) {
    return this.admin.tenantAuditLog(tenant, query);
  }

  @Get("organizations/:organizationId/integrations")
  @RequirePermissions("channels.read")
  integrations(@CurrentTenant() tenant: TenantContext) {
    return this.admin.integrations(tenant);
  }
}
