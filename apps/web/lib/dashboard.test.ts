import type { AuthUser } from "@saas/shared-types";
import { describe, expect, it } from "vitest";
import { availableActions, navigationFor, protectedLoginPath } from "./dashboard";

const user: AuthUser = {
  id: "c8b47301-4545-48d0-8722-05063bfe7f06",
  email: "moderator@example.test",
  displayName: "Demo Moderator",
  platformRole: "USER",
  memberships: [],
};

describe("dashboard authorization presentation", () => {
  it("shows the owner-focused routes appropriate to each workspace role", () => {
    expect(navigationFor(user).map(({ href }) => href)).toEqual([
      "/dashboard",
      "/dashboard/account",
    ]);
    const superUser = { ...user, platformRole: "SUPER_ADMIN" as const };
    expect(navigationFor(superUser).map(({ href }) => href)).toEqual([
      "/dashboard",
      "/dashboard/account",
    ]);
    const membership = {
      id: "203e195a-a5f4-4359-aaec-23ea155b86ea",
      organizationId: "66a0a966-2802-4d17-ac88-a40943d437ff",
      role: "MODERATOR" as const,
      displayName: "Demo Moderator",
      organization: { name: "Demo", slug: "demo" },
    };
    const moderatorRoutes = navigationFor({ ...user, memberships: [membership] }, membership).map(
      ({ href }) => href,
    );
    expect(moderatorRoutes).toEqual([
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/analytics",
      "/dashboard/social-accounts",
      "/dashboard/account",
    ]);
    const adminRoutes = navigationFor(
      { ...user, memberships: [{ ...membership, role: "ORGANIZATION_ADMIN" }] },
      { ...membership, role: "ORGANIZATION_ADMIN" },
    ).map(({ href }) => href);
    expect(adminRoutes).toEqual([
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/moderators",
      "/dashboard/teams",
      "/dashboard/analytics",
      "/dashboard/social-accounts",
      "/dashboard/activity-logs",
      "/dashboard/settings",
      "/dashboard/account",
    ]);
    expect(adminRoutes).not.toContain("/dashboard/platform/organizations");
  });

  it("keeps tenant and platform actions separate", () => {
    expect(availableActions(undefined, true)).toEqual([
      "Access explicit platform administration routes",
    ]);
    expect(availableActions("MODERATOR", false)).not.toContain(
      "Access explicit platform administration routes",
    );
  });

  it("builds a safe login redirect only for protected dashboard paths", () => {
    expect(protectedLoginPath("/dashboard/account")).toBe("/login?next=%2Fdashboard%2Faccount");
    expect(protectedLoginPath("https://attacker.test")).toBe("/login?next=%2Fdashboard");
  });
});
