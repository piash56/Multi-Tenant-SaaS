import type { MembershipRole, PlatformRole } from "../generated/prisma/enums.js";

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  platformRole: PlatformRole;
}

export interface TenantContext extends AuthenticatedPrincipal {
  organizationId: string;
  membershipId: string;
  membershipRole: MembershipRole;
  permissions: readonly Permission[];
}

export const permissions = [
  "organization.read",
  "organization.update",
  "members.read",
  "members.manage",
  "invitations.manage",
  "channels.read",
  "channels.manage",
  "inbox.read",
  "messages.reply",
  "comments.reply",
  "comments.moderate",
  "assignments.self",
  "assignments.manage",
  "conversations.resolve",
  "analytics.self",
  "analytics.team",
  "audit.read",
  "platform.organizations.manage",
  "platform.users.manage",
  "platform.audit.read",
] as const;

export type Permission = (typeof permissions)[number];
