import type { AuthUser, MembershipRole } from "@saas/shared-types";

export const roleLabels: Record<MembershipRole, string> = {
  ORGANIZATION_ADMIN: "Owner / Admin",
  SUPERVISOR: "Supervisor",
  MODERATOR: "Moderator",
};

export interface NavigationItem {
  href: string;
  label: string;
  description: string;
}

export function navigationFor(
  user: AuthUser,
  membership?: AuthUser["memberships"][number],
): NavigationItem[] {
  void user;
  const dashboard = {
    href: "/dashboard",
    label: "Dashboard",
    description: "Business workspace overview",
  };
  const account = {
    href: "/dashboard/account",
    label: "My Account",
    description: "Identity and access details",
  };
  if (!membership) return [dashboard, account];

  const inbox = {
    href: "/dashboard/inbox",
    label: "Unified Inbox",
    description: "Upcoming messaging workspace",
  };
  const analytics = {
    href: "/dashboard/analytics",
    label: "Analytics & Leaderboard",
    description: "Upcoming performance reporting",
  };
  const socialAccounts = {
    href: "/dashboard/social-accounts",
    label: "Social Media Accounts",
    description: "Connection status",
  };
  if (membership.role === "MODERATOR")
    return [dashboard, inbox, analytics, socialAccounts, account];

  const teamManagement = [
    {
      href: "/dashboard/moderators",
      label: "Moderators",
      description: "People, roles, and access",
    },
    { href: "/dashboard/teams", label: "Teams", description: "Team membership" },
  ];
  if (membership.role === "SUPERVISOR")
    return [dashboard, inbox, ...teamManagement, analytics, socialAccounts, account];

  return [
    dashboard,
    inbox,
    ...teamManagement,
    analytics,
    socialAccounts,
    {
      href: "/dashboard/activity-logs",
      label: "Activity Logs",
      description: "Business administration history",
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      description: "Business workspace profile",
    },
    account,
  ];
}

export function availableActions(role: MembershipRole | undefined, superAdmin: boolean): string[] {
  if (superAdmin) return ["Access explicit platform administration routes"];
  if (role === "ORGANIZATION_ADMIN")
    return [
      "Manage business settings",
      "Manage moderators, teams, and invitations",
      "Review business activity logs",
    ];
  if (role === "SUPERVISOR")
    return [
      "View organization settings and members",
      "Coordinate inbox assignments",
      "View team analytics",
    ];
  if (role === "MODERATOR")
    return [
      "Work assigned conversations",
      "Reply to supported messages",
      "View personal analytics",
    ];
  return [];
}

export function protectedLoginPath(pathname: string): string {
  const safePath = pathname.startsWith("/dashboard") ? pathname : "/dashboard";
  return `/login?next=${encodeURIComponent(safePath)}`;
}
