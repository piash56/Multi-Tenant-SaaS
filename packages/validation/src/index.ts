import { z } from "zod";

export const healthSchema = z.object({
  status: z.enum(["ok", "error"]),
  service: z.enum(["api", "worker"]),
  timestamp: z.iso.datetime(),
});

export const readinessSchema = healthSchema.extend({
  dependencies: z.object({
    postgres: z.enum(["up", "down"]),
    redis: z.enum(["up", "down"]),
  }),
});

export const membershipRoleSchema = z.enum(["ORGANIZATION_ADMIN", "SUPERVISOR", "MODERATOR"]);

export const authResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().min(1),
    platformRole: z.enum(["USER", "SUPER_ADMIN"]),
    memberships: z.array(
      z.object({
        id: z.uuid(),
        organizationId: z.uuid(),
        role: membershipRoleSchema,
        displayName: z.string().min(1),
        organization: z.object({ name: z.string().min(1), slug: z.string().min(1) }),
      }),
    ),
  }),
});

export const organizationContextSchema = z.object({
  tenant: z.object({
    userId: z.uuid(),
    sessionId: z.uuid(),
    platformRole: z.enum(["USER", "SUPER_ADMIN"]),
    organizationId: z.uuid(),
    membershipId: z.uuid(),
    membershipRole: membershipRoleSchema,
    permissions: z.array(z.string()),
  }),
});

export function parseCommaSeparatedUrls(value: string): string[] {
  const urls = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of urls) new URL(entry);
  return urls;
}
