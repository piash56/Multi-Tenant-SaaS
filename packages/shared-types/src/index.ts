export interface ServiceHealth {
  status: "ok" | "error";
  service: "api" | "worker";
  timestamp: string;
}

export interface ReadinessHealth extends ServiceHealth {
  dependencies: {
    postgres: "up" | "down";
    redis: "up" | "down";
  };
}

export const realtimeEventNames = {
  connected: "system:connected",
} as const;

export type PlatformRole = "USER" | "SUPER_ADMIN";
export type MembershipRole = "ORGANIZATION_ADMIN" | "SUPERVISOR" | "MODERATOR";

export interface AuthMembership {
  id: string;
  organizationId: string;
  role: MembershipRole;
  displayName: string;
  organization: {
    name: string;
    slug: string;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  memberships: AuthMembership[];
}

export interface AuthResponse {
  user: AuthUser;
}

export interface OrganizationContext {
  organizationId: string;
  membershipId: string;
  membershipRole: MembershipRole;
  permissions: string[];
}

export interface OrganizationContextResponse {
  tenant: OrganizationContext;
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  settingsVersion?: number;
  _count?: { memberships: number; invitations: number; channelAccounts: number; teams?: number };
}

export interface UserSummary {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  status: UserStatus;
  platformRole: PlatformRole;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberships?: Array<{
    id: string;
    role: MembershipRole;
    status: MembershipStatus;
    organization: { id: string; name: string; slug: string; status: OrganizationStatus };
  }>;
}

export interface AuditEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorMembershipId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: string;
  requestId: string | null;
  changes: unknown;
  createdAt: string;
  actorUser: { id: string; email: string; displayName: string } | null;
}

export interface PlatformOverviewResponse {
  counts: {
    organizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    users: number;
    activeMemberships: number;
    pendingInvitations: number;
  };
  recentActivity: AuditEntry[];
}

export interface MembershipSummary {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  displayName: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; displayName: string; status: UserStatus };
  _count?: { teamMemberships: number };
}

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { memberships: number };
}

export interface InvitationSummary {
  id: string;
  normalizedEmail: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  inviterUser?: { id: string; displayName: string; email: string } | null;
}

export interface IntegrationAccountSummary {
  id: string;
  platform: "FACEBOOK_MESSENGER" | "INSTAGRAM" | "WHATSAPP_BUSINESS";
  displayName: string;
  status: "PENDING" | "ACTIVE" | "DISCONNECTED" | "ERROR";
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  disconnectedAt: string | null;
}

export interface PageResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface AnalyticsMetric {
  value: number | null;
  status: "available" | "unavailable";
  sampleSize?: number;
  unit?: "milliseconds";
}

export interface ModeratorPerformance {
  membershipId: string;
  displayName: string;
  role: MembershipRole;
  conversationsAssigned: AnalyticsMetric;
  conversationsReassigned: AnalyticsMetric;
  conversationsReassignedAway: AnalyticsMetric;
  currentPendingWorkload: AnalyticsMetric;
  repliesAuthored: AnalyticsMetric;
  conversationsResolved: AnalyticsMetric;
  conversationsReopened: AnalyticsMetric;
  assistedConversations: AnalyticsMetric;
  firstResponseTime: AnalyticsMetric;
  averageResponseTime: AnalyticsMetric;
  resolutionTime: AnalyticsMetric;
  ranks: { replies: number | null; resolved: number | null; responseTime: number | null };
}

export interface AnalyticsResponse {
  range: { preset: string; from: string; toExclusive: string; timezone: string };
  scope: { kind: "self" | "teams" | "organization"; teamIds: string[] };
  definitionsVersion: number;
  organization: Omit<ModeratorPerformance, "membershipId" | "displayName" | "role" | "ranks">;
  moderators: ModeratorPerformance[];
  leaderboard: Array<{
    membershipId: string;
    displayName: string;
    repliesAuthored: number | null;
    conversationsResolved: number | null;
    averageResponseTime: AnalyticsMetric;
    ranks: ModeratorPerformance["ranks"];
  }>;
  teams: Array<{
    id: string;
    name: string;
    members: number;
    metrics: AnalyticsResponse["organization"];
  }>;
}
