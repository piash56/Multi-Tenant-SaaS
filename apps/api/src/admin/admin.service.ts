import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import type { AuthenticatedPrincipal, TenantContext } from "../auth/auth.types.js";
import { PasswordService } from "../auth/password.service.js";
import { PrismaService } from "../database/prisma.service.js";
import type {
  AuditListQueryDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  CreateTeamDto,
  InvitationListQueryDto,
  MemberListQueryDto,
  OrganizationListQueryDto,
  PageQueryDto,
  RegisterInvitationDto,
  TeamListQueryDto,
  UpdateMembershipDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
  UpdateTeamDto,
  UpdateUserStatusDto,
  UserListQueryDto,
} from "./admin.dto.js";

const userSafeSelect = {
  id: true,
  email: true,
  normalizedEmail: true,
  displayName: true,
  status: true,
  platformRole: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PasswordService)
    private readonly passwords: PasswordService,
  ) {}

  private paginationValues(query: PageQueryDto) {
    const page = Number.isInteger(query.page) && query.page >= 1 ? query.page : 1;
    const limit =
      Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 100 ? query.limit : 20;
    return { page, limit };
  }

  private page(query: PageQueryDto) {
    const { page, limit } = this.paginationValues(query);
    return { skip: (page - 1) * limit, take: limit };
  }

  private pagination(total: number, query: PageQueryDto) {
    const { page, limit } = this.paginationValues(query);
    return { page, limit, total, pages: Math.ceil(total / limit) };
  }

  async platformOverview() {
    const [
      organizations,
      activeOrganizations,
      suspendedOrganizations,
      users,
      activeMemberships,
      pendingInvitations,
      recentActivity,
    ] = await this.prisma.$transaction([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      this.prisma.organization.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.membership.count({ where: { status: "ACTIVE" } }),
      this.prisma.invitation.count({ where: { status: "PENDING", expiresAt: { gt: new Date() } } }),
      this.prisma.auditLog.findMany({
        where: { organizationId: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          result: true,
          createdAt: true,
          actorUser: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);
    return {
      counts: {
        organizations,
        activeOrganizations,
        suspendedOrganizations,
        users,
        activeMemberships,
        pendingInvitations,
      },
      recentActivity,
    };
  }

  async listOrganizations(query: OrganizationListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { memberships: true, invitations: true, channelAccounts: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  async organizationDetail(id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        settingsVersion: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { memberships: true, invitations: true, channelAccounts: true, teams: true },
        },
      },
    });
    if (!organization) throw new NotFoundException("Organization not found");
    return { organization };
  }

  async createOrganization(
    actor: AuthenticatedPrincipal,
    input: CreateOrganizationDto,
    requestId?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.name.trim(),
            slug: input.slug.trim().toLowerCase(),
            timezone: input.timezone?.trim() || "UTC",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            timezone: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.userId,
            action: "platform.organization.create",
            targetType: "ORGANIZATION",
            targetId: organization.id,
            result: "SUCCESS",
            requestId: requestId ?? null,
            changes: {
              name: organization.name,
              slug: organization.slug,
              status: organization.status,
            },
          },
        });
        return { organization };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("An organization with this slug already exists");
      throw error;
    }
  }

  async updatePlatformOrganization(
    actor: AuthenticatedPrincipal,
    id: string,
    input: UpdateOrganizationDto,
    requestId?: string,
  ) {
    const existing = await this.organizationDetail(id);
    const organization = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone.trim() } : {}),
          settingsVersion: { increment: 1 },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          action: "platform.organization.update",
          targetType: "ORGANIZATION",
          targetId: id,
          result: "SUCCESS",
          requestId: requestId ?? null,
          changes: {
            before: { name: existing.organization.name, timezone: existing.organization.timezone },
            after: { name: updated.name, timezone: updated.timezone },
          },
        },
      });
      return updated;
    });
    return { organization };
  }

  async updateOrganizationStatus(
    actor: AuthenticatedPrincipal,
    id: string,
    input: UpdateOrganizationStatusDto,
    requestId?: string,
  ) {
    if (input.status === "CLOSED")
      throw new BadRequestException("Closing organizations is not supported in Milestone 5");
    const existing = await this.organizationDetail(id);
    const organization = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id },
        data: { status: input.status },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          action: "platform.organization.status",
          targetType: "ORGANIZATION",
          targetId: id,
          result: "SUCCESS",
          requestId: requestId ?? null,
          changes: { from: existing.organization.status, to: updated.status },
        },
      });
      return updated;
    });
    return { organization };
  }

  async listUsers(query: UserListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.platformRole ? { platformRole: query.platformRole } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: "desc" },
        select: {
          ...userSafeSelect,
          memberships: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              role: true,
              status: true,
              organization: { select: { id: true, name: true, slug: true, status: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...userSafeSelect,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            organization: { select: { id: true, name: true, slug: true, status: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return { user };
  }

  async updateUserStatus(
    actor: AuthenticatedPrincipal,
    id: string,
    input: UpdateUserStatusDto,
    requestId?: string,
  ) {
    const { user: existing } = await this.userDetail(id);
    if (actor.userId === id && input.status !== "ACTIVE")
      throw new BadRequestException("You cannot disable your own account");
    if (existing.platformRole === "SUPER_ADMIN" && input.status !== "ACTIVE") {
      const activeAdmins = await this.prisma.user.count({
        where: { platformRole: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
      });
      if (activeAdmins <= 1)
        throw new ConflictException("The last active Super Admin cannot be disabled");
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: input.status },
        select: userSafeSelect,
      });
      if (input.status !== "ACTIVE") {
        const now = new Date();
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now, revokeReason: "USER_DISABLED", accessVersion: { increment: 1 } },
        });
        await tx.authRefreshToken.updateMany({
          where: { session: { userId: id }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          action: "platform.user.status",
          targetType: "USER",
          targetId: id,
          result: "SUCCESS",
          requestId: requestId ?? null,
          changes: { from: existing.status, to: updated.status },
        },
      });
      return updated;
    });
    return { user };
  }

  async platformAudit(query: AuditListQueryDto) {
    return this.auditPage({ organizationId: null }, query);
  }

  async tenantOverview(tenant: TenantContext) {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        settingsVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const [members, teams, pendingInvitations, integrations] = await this.prisma.$transaction([
      this.prisma.membership.count({
        where: { organizationId: tenant.organizationId, status: "ACTIVE" },
      }),
      this.prisma.team.count({ where: { organizationId: tenant.organizationId, isActive: true } }),
      this.prisma.invitation.count({
        where: {
          organizationId: tenant.organizationId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.connectedChannelAccount.count({
        where: { organizationId: tenant.organizationId },
      }),
    ]);
    return { organization, counts: { members, teams, pendingInvitations, integrations } };
  }

  async updateTenantOrganization(
    tenant: TenantContext,
    input: UpdateOrganizationDto,
    requestId?: string,
  ) {
    const before = await this.prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId },
    });
    const organization = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: tenant.organizationId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone.trim() } : {}),
          settingsVersion: { increment: 1 },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          timezone: true,
          settingsVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      await this.tenantAudit(
        tx,
        tenant,
        "organization.update",
        "ORGANIZATION",
        tenant.organizationId,
        requestId,
        {
          before: { name: before.name, timezone: before.timezone },
          after: { name: updated.name, timezone: updated.timezone },
        },
      );
      return updated;
    });
    return { organization };
  }

  async listMembers(tenant: TenantContext, query: MemberListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.MembershipWhereInput = {
      organizationId: tenant.organizationId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          role: true,
          status: true,
          displayName: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, displayName: true, status: true } },
          _count: { select: { teamMemberships: true } },
        },
      }),
      this.prisma.membership.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  async updateMembership(
    tenant: TenantContext,
    id: string,
    input: UpdateMembershipDto,
    requestId?: string,
  ) {
    if (input.role === undefined && input.status === undefined)
      throw new BadRequestException("A role or status change is required");
    const existing = await this.prisma.membership.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { user: { select: { email: true } } },
    });
    if (!existing) throw new NotFoundException("Member not found");
    if (existing.id === tenant.membershipId && input.status && input.status !== "ACTIVE")
      throw new BadRequestException("You cannot deactivate your own membership");
    const removesAdmin =
      existing.role === "ORGANIZATION_ADMIN" &&
      ((input.role && input.role !== "ORGANIZATION_ADMIN") ||
        (input.status && input.status !== "ACTIVE"));
    if (removesAdmin) {
      const admins = await this.prisma.membership.count({
        where: {
          organizationId: tenant.organizationId,
          role: "ORGANIZATION_ADMIN",
          status: "ACTIVE",
        },
      });
      if (admins <= 1)
        throw new ConflictException(
          "The last active Organization Admin cannot be removed or demoted",
        );
    }
    const membership = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        select: {
          id: true,
          role: true,
          status: true,
          displayName: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, displayName: true, status: true } },
        },
      });
      await this.tenantAudit(tx, tenant, "membership.update", "MEMBERSHIP", id, requestId, {
        from: { role: existing.role, status: existing.status },
        to: { role: updated.role, status: updated.status },
      });
      return updated;
    });
    return { membership };
  }

  async listTeams(tenant: TenantContext, query: TeamListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.TeamWhereInput = {
      organizationId: tenant.organizationId,
      ...(query.active !== undefined ? { isActive: query.active } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where,
        ...this.page(query),
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { memberships: true } },
        },
      }),
      this.prisma.team.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  async teamDetail(tenant: TenantContext, id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, organizationId: tenant.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            createdAt: true,
            membership: {
              select: {
                id: true,
                displayName: true,
                role: true,
                status: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });
    if (!team) throw new NotFoundException("Team not found");
    return { team };
  }

  async createTeam(tenant: TenantContext, input: CreateTeamDto, requestId?: string) {
    const name = input.name.trim();
    try {
      const team = await this.prisma.$transaction(async (tx) => {
        const created = await tx.team.create({
          data: {
            organizationId: tenant.organizationId,
            name,
            normalizedName: name.toLowerCase(),
            description: input.description?.trim() || null,
          },
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        await this.tenantAudit(tx, tenant, "team.create", "TEAM", created.id, requestId, {
          name: created.name,
        });
        return created;
      });
      return { team };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("A team with this name already exists");
      throw error;
    }
  }

  async updateTeam(tenant: TenantContext, id: string, input: UpdateTeamDto, requestId?: string) {
    const existing = await this.prisma.team.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existing) throw new NotFoundException("Team not found");
    const name = input.name?.trim();
    try {
      const team = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.team.update({
          where: { id },
          data: {
            ...(name ? { name, normalizedName: name.toLowerCase() } : {}),
            ...(input.description !== undefined
              ? { description: input.description.trim() || null }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        await this.tenantAudit(tx, tenant, "team.update", "TEAM", id, requestId, {
          from: { name: existing.name, isActive: existing.isActive },
          to: { name: updated.name, isActive: updated.isActive },
        });
        return updated;
      });
      return { team };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("A team with this name already exists");
      throw error;
    }
  }

  async addTeamMember(
    tenant: TenantContext,
    teamId: string,
    membershipId: string,
    requestId?: string,
  ) {
    const [team, membership] = await Promise.all([
      this.prisma.team.findFirst({
        where: { id: teamId, organizationId: tenant.organizationId, isActive: true },
      }),
      this.prisma.membership.findFirst({
        where: { id: membershipId, organizationId: tenant.organizationId, status: "ACTIVE" },
      }),
    ]);
    if (!team || !membership) throw new NotFoundException("Active team or member not found");
    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.teamMembership.create({
          data: { organizationId: tenant.organizationId, teamId, membershipId },
          select: { id: true, teamId: true, membershipId: true, createdAt: true },
        });
        await this.tenantAudit(
          tx,
          tenant,
          "team.member.add",
          "TEAM_MEMBERSHIP",
          created.id,
          requestId,
          { teamId, membershipId },
        );
        return created;
      });
      return { assignment };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("This member is already assigned to the team");
      throw error;
    }
  }

  async removeTeamMember(
    tenant: TenantContext,
    teamId: string,
    membershipId: string,
    requestId?: string,
  ) {
    const assignment = await this.prisma.teamMembership.findFirst({
      where: { teamId, membershipId, organizationId: tenant.organizationId },
    });
    if (!assignment) throw new NotFoundException("Team assignment not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembership.delete({ where: { id: assignment.id } });
      await this.tenantAudit(
        tx,
        tenant,
        "team.member.remove",
        "TEAM_MEMBERSHIP",
        assignment.id,
        requestId,
        { teamId, membershipId },
      );
    });
  }

  async listInvitations(tenant: TenantContext, query: InvitationListQueryDto) {
    await this.expireInvitations(tenant.organizationId);
    const search = query.search?.trim();
    const where: Prisma.InvitationWhereInput = {
      organizationId: tenant.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { normalizedEmail: { contains: search.toLowerCase() } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          normalizedEmail: true,
          role: true,
          status: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
          inviterUser: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.invitation.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  async createInvitation(tenant: TenantContext, input: CreateInvitationDto, requestId?: string) {
    const normalizedEmail = input.email.trim().toLowerCase();
    await this.expireInvitations(tenant.organizationId);
    const existingMember = await this.prisma.membership.findFirst({
      where: {
        organizationId: tenant.organizationId,
        user: { normalizedEmail },
        status: { not: "REMOVED" },
      },
    });
    if (existingMember)
      throw new ConflictException("This user already has an organization membership");
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);
    try {
      const invitation = await this.prisma.$transaction(async (tx) => {
        const created = await tx.invitation.create({
          data: {
            organizationId: tenant.organizationId,
            normalizedEmail,
            role: input.role,
            tokenHash,
            inviterMembershipId: tenant.membershipId,
            inviterUserId: tenant.userId,
            expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
          },
          select: {
            id: true,
            normalizedEmail: true,
            role: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });
        await this.tenantAudit(
          tx,
          tenant,
          "invitation.create",
          "INVITATION",
          created.id,
          requestId,
          {
            email: normalizedEmail,
            role: created.role,
            expiresAt: created.expiresAt.toISOString(),
          },
        );
        return created;
      });
      return {
        invitation,
        ...(process.env.NODE_ENV === "development"
          ? { localAcceptancePath: `/invitations/accept?token=${encodeURIComponent(rawToken)}` }
          : {}),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("A pending invitation already exists for this email");
      throw error;
    }
  }

  async revokeInvitation(tenant: TenantContext, id: string, requestId?: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status !== "PENDING")
      throw new ConflictException("Only pending invitations can be revoked");
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.invitation.update({
        where: { id },
        data: { status: "REVOKED", revokedAt: new Date() },
        select: {
          id: true,
          normalizedEmail: true,
          role: true,
          status: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
      await this.tenantAudit(tx, tenant, "invitation.revoke", "INVITATION", id, requestId, {
        email: invitation.normalizedEmail,
      });
      return value;
    });
    return { invitation: updated };
  }

  async acceptInvitation(principal: AuthenticatedPrincipal, rawToken: string, requestId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { id: true, normalizedEmail: true, displayName: true, status: true },
    });
    if (user.status !== "ACTIVE") throw new ForbiddenException("Account is not active");
    return this.consumeInvitation(rawToken, user, requestId);
  }

  async registerInvitation(input: RegisterInvitationDto, requestId?: string) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const tokenHash = this.hashToken(input.token);
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    this.assertUsableInvitation(invitation, normalizedEmail);
    const existing = await this.prisma.user.findUnique({ where: { normalizedEmail } });
    if (existing)
      throw new ConflictException("An account already exists; sign in to accept this invitation");
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.invitation.updateMany({
            where: { id: invitation!.id, status: "PENDING", expiresAt: { gt: new Date() } },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
          if (claimed.count !== 1)
            throw new ConflictException("Invitation has already been used or is no longer valid");
          const user = await tx.user.create({
            data: {
              email: input.email.trim(),
              normalizedEmail,
              displayName: input.displayName.trim(),
              passwordHash,
              status: "ACTIVE",
              emailVerifiedAt: new Date(),
            },
            select: userSafeSelect,
          });
          const membership = await tx.membership.create({
            data: {
              organizationId: invitation!.organizationId,
              userId: user.id,
              role: invitation!.role,
              status: "ACTIVE",
              displayName: input.displayName.trim(),
              joinedAt: new Date(),
            },
            select: { id: true, organizationId: true, role: true, status: true, displayName: true },
          });
          await tx.auditLog.create({
            data: {
              organizationId: invitation!.organizationId,
              actorUserId: user.id,
              actorMembershipId: membership.id,
              action: "invitation.accept",
              targetType: "INVITATION",
              targetId: invitation!.id,
              result: "SUCCESS",
              requestId: requestId ?? null,
              changes: { userId: user.id, membershipId: membership.id },
            },
          });
          return { user, membership };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        throw new ConflictException("The invitation or account has already been used");
      throw error;
    }
  }

  private async consumeInvitation(
    rawToken: string,
    user: { id: string; normalizedEmail: string; displayName: string },
    requestId?: string,
  ) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
    this.assertUsableInvitation(invitation, user.normalizedEmail);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.invitation.updateMany({
            where: { id: invitation!.id, status: "PENDING", expiresAt: { gt: new Date() } },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
          if (claimed.count !== 1)
            throw new ConflictException("Invitation has already been used or is no longer valid");
          const membership = await tx.membership.create({
            data: {
              organizationId: invitation!.organizationId,
              userId: user.id,
              role: invitation!.role,
              status: "ACTIVE",
              displayName: user.displayName,
              joinedAt: new Date(),
            },
            select: { id: true, organizationId: true, role: true, status: true, displayName: true },
          });
          await tx.auditLog.create({
            data: {
              organizationId: invitation!.organizationId,
              actorUserId: user.id,
              actorMembershipId: membership.id,
              action: "invitation.accept",
              targetType: "INVITATION",
              targetId: invitation!.id,
              result: "SUCCESS",
              requestId: requestId ?? null,
              changes: { userId: user.id, membershipId: membership.id },
            },
          });
          return { membership };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        throw new ConflictException("Membership already exists or invitation was already used");
      throw error;
    }
  }

  private assertUsableInvitation(
    invitation: { normalizedEmail: string; status: string; expiresAt: Date } | null,
    normalizedEmail: string,
  ) {
    if (!invitation || invitation.normalizedEmail !== normalizedEmail)
      throw new NotFoundException("Invitation not found");
    if (invitation.status !== "PENDING")
      throw new ConflictException("Invitation has already been used or revoked");
    if (invitation.expiresAt <= new Date()) throw new ConflictException("Invitation has expired");
  }

  async integrations(tenant: TenantContext) {
    const accounts = await this.prisma.connectedChannelAccount.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ platform: "asc" }, { displayName: "asc" }],
      select: {
        id: true,
        platform: true,
        displayName: true,
        status: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        disconnectedAt: true,
      },
    });
    return { providers: ["FACEBOOK_MESSENGER", "INSTAGRAM", "WHATSAPP_BUSINESS"], accounts };
  }

  async tenantAuditLog(tenant: TenantContext, query: AuditListQueryDto) {
    return this.auditPage({ organizationId: tenant.organizationId }, query);
  }

  private async auditPage(scope: Prisma.AuditLogWhereInput, query: AuditListQueryDto) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);
    const where: Prisma.AuditLogWhereInput = {
      ...scope,
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to ? { createdAt } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        ...this.page(query),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          organizationId: true,
          actorUserId: true,
          actorMembershipId: true,
          action: true,
          targetType: true,
          targetId: true,
          result: true,
          requestId: true,
          changes: true,
          createdAt: true,
          actorUser: { select: { id: true, email: true, displayName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, pagination: this.pagination(total, query) };
  }

  private async expireInvitations(organizationId: string) {
    await this.prisma.invitation.updateMany({
      where: { organizationId, status: "PENDING", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async tenantAudit(
    tx: Prisma.TransactionClient,
    tenant: TenantContext,
    action: string,
    targetType: string,
    targetId: string,
    requestId?: string,
    changes?: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        actorMembershipId: tenant.membershipId,
        action,
        targetType,
        targetId,
        result: "SUCCESS",
        requestId: requestId ?? null,
        ...(changes !== undefined ? { changes } : {}),
      },
    });
  }
}
