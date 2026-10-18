import "reflect-metadata";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { argon2id, hash } from "argon2";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../src/database/prisma.service.js";

const password = "Correct-Horse-42!";

function csrfFrom(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  const csrf = cookies.find((cookie) => cookie.startsWith("saas_csrf="));
  if (!csrf) throw new Error("CSRF cookie missing");
  return csrf.split(";", 1)[0]!.slice("saas_csrf=".length);
}

describe("Milestone 5 administration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emails = {
    super: `m5-super-${suffix}@example.test`,
    admin: `m5-admin-${suffix}@example.test`,
    supervisor: `m5-supervisor-${suffix}@example.test`,
    moderator: `m5-moderator-${suffix}@example.test`,
    target: `m5-target-${suffix}@example.test`,
  };
  let orgA: string;
  let orgB: string;
  let adminMembership: string;
  let supervisorMembership: string;
  let moderatorMembership: string;
  let targetUserId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL ??=
      "postgresql://saas_app:local-development-only@localhost:5433/saas_test?schema=public";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.CORS_ORIGINS = "http://localhost:3000";
    process.env.AUTH_JWT_SECRET = "test-only-auth-secret-at-least-32-characters";
    process.env.AUTH_JWT_ISSUER = "unified-inbox-api";
    process.env.AUTH_JWT_AUDIENCE = "unified-inbox-clients";
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.SWAGGER_ENABLED = "false";
    const { createApplication } = await import("../src/bootstrap.js");
    app = await createApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const [a, b] = await Promise.all([
      prisma.organization.create({ data: { name: "M5 Tenant A", slug: `m5-a-${suffix}` } }),
      prisma.organization.create({ data: { name: "M5 Tenant B", slug: `m5-b-${suffix}` } }),
    ]);
    orgA = a.id;
    orgB = b.id;
    const [superUser, admin, supervisor, moderator, target] = await Promise.all([
      prisma.user.create({
        data: {
          email: emails.super,
          normalizedEmail: emails.super,
          displayName: "M5 Super",
          passwordHash,
          platformRole: "SUPER_ADMIN",
        },
      }),
      prisma.user.create({
        data: {
          email: emails.admin,
          normalizedEmail: emails.admin,
          displayName: "M5 Admin",
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: emails.supervisor,
          normalizedEmail: emails.supervisor,
          displayName: "M5 Supervisor",
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: emails.moderator,
          normalizedEmail: emails.moderator,
          displayName: "M5 Moderator",
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: emails.target,
          normalizedEmail: emails.target,
          displayName: "M5 Target",
          passwordHash,
        },
      }),
    ]);
    void superUser;
    targetUserId = target.id;
    const [adminMember, supervisorMember, moderatorMember] = await Promise.all([
      prisma.membership.create({
        data: {
          organizationId: orgA,
          userId: admin.id,
          role: "ORGANIZATION_ADMIN",
          displayName: "M5 Admin",
          joinedAt: new Date(),
        },
      }),
      prisma.membership.create({
        data: {
          organizationId: orgA,
          userId: supervisor.id,
          role: "SUPERVISOR",
          displayName: "M5 Supervisor",
          joinedAt: new Date(),
        },
      }),
      prisma.membership.create({
        data: {
          organizationId: orgA,
          userId: moderator.id,
          role: "MODERATOR",
          displayName: "M5 Moderator",
          joinedAt: new Date(),
        },
      }),
    ]);
    adminMembership = adminMember.id;
    supervisorMembership = supervisorMember.id;
    moderatorMembership = moderatorMember.id;
  }, 30_000);

  afterAll(async () => app?.close());

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post("/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ email, password })
      .expect(200);
    return { agent, csrf: csrfFrom(response) };
  }

  it("allows Super Admin platform overview and organization management but denies tenant roles", async () => {
    const superSession = await login(emails.super);
    const overview = await superSession.agent.get("/platform/overview").expect(200);
    expect(overview.body.counts.organizations).toBeGreaterThanOrEqual(2);
    const organizations = await superSession.agent
      .get("/platform/organizations?page=1")
      .expect(200);
    expect(organizations.body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(organizations.body.items.length).toBeGreaterThanOrEqual(2);
    const platformAudit = await superSession.agent.get("/platform/audit-logs").expect(200);
    expect(platformAudit.body.pagination).toMatchObject({ page: 1, limit: 20 });
    const created = await superSession.agent
      .post("/platform/organizations")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", superSession.csrf)
      .send({ name: "Created Tenant", slug: `created-${suffix}`, timezone: "UTC" })
      .expect(201);
    await superSession.agent
      .patch(`/platform/organizations/${created.body.organization.id}/status`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", superSession.csrf)
      .send({ status: "SUSPENDED" })
      .expect(200);
    const adminSession = await login(emails.admin);
    await adminSession.agent.get("/platform/overview").expect(403);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "platform.organization.status", targetId: created.body.organization.id },
    });
    expect(audit?.actorUserId).toBeTruthy();
  });

  it("provides safe user administration, revokes disabled sessions, and blocks self-disable", async () => {
    const superSession = await login(emails.super);
    const users = await superSession.agent
      .get(`/platform/users?page=1&search=${encodeURIComponent(emails.target)}`)
      .expect(200);
    expect(users.body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(users.body.items[0]).not.toHaveProperty("passwordHash");
    const targetSession = await login(emails.target);
    await superSession.agent
      .patch(`/platform/users/${targetUserId}/status`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", superSession.csrf)
      .send({ status: "DISABLED" })
      .expect(200);
    await targetSession.agent.get("/auth/me").expect(401);
    const self = await prisma.user.findUniqueOrThrow({ where: { normalizedEmail: emails.super } });
    await superSession.agent
      .patch(`/platform/users/${self.id}/status`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", superSession.csrf)
      .send({ status: "DISABLED" })
      .expect(400);
  });

  it("enforces organization roles, cross-tenant isolation, and last-admin protection", async () => {
    const adminSession = await login(emails.admin);
    await adminSession.agent.get(`/organizations/${orgA}/members`).expect(200);
    await adminSession.agent.get(`/organizations/${orgB}/members`).expect(404);
    await adminSession.agent
      .patch(`/organizations/${orgA}/members/${adminMembership}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ role: "MODERATOR" })
      .expect(409);
    await adminSession.agent
      .patch(`/organizations/${orgA}/members/${moderatorMembership}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ role: "SUPERVISOR" })
      .expect(200);
    const moderatorSession = await login(emails.moderator);
    await moderatorSession.agent
      .patch(`/organizations/${orgA}/settings`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", moderatorSession.csrf)
      .send({ name: "No" })
      .expect(403);
  });

  it("creates teams and prevents duplicate or cross-organization assignments", async () => {
    const adminSession = await login(emails.admin);
    const created = await adminSession.agent
      .post(`/organizations/${orgA}/teams`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ name: "Support", description: "Primary support team" })
      .expect(201);
    const teamId = created.body.team.id;
    await adminSession.agent
      .post(`/organizations/${orgA}/teams`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ name: "support" })
      .expect(409);
    await adminSession.agent
      .post(`/organizations/${orgA}/teams/${teamId}/members`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ membershipId: moderatorMembership })
      .expect(201);
    await adminSession.agent
      .post(`/organizations/${orgA}/teams/${teamId}/members`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ membershipId: moderatorMembership })
      .expect(409);
    const other = await prisma.membership.create({
      data: {
        organizationId: orgB,
        userId: (await prisma.user.findUniqueOrThrow({ where: { normalizedEmail: emails.target } }))
          .id,
        role: "MODERATOR",
        displayName: "Other",
      },
    });
    await adminSession.agent
      .post(`/organizations/${orgA}/teams/${teamId}/members`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .send({ membershipId: other.id })
      .expect(404);
    await adminSession.agent
      .delete(`/organizations/${orgA}/teams/${teamId}/members/${moderatorMembership}`)
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", adminSession.csrf)
      .expect(204);
  });

  it("accepts a valid invitation once and rejects wrong identity, expiry, revocation, and replay", async () => {
    const inviteeEmail = `invitee-${suffix}@example.test`;
    const invitee = await prisma.user.create({
      data: {
        email: inviteeEmail,
        normalizedEmail: inviteeEmail,
        displayName: "Invitee",
        passwordHash: await hash(password),
      },
    });
    const inviteeSession = await login(inviteeEmail);
    async function invitation(
      raw: string,
      overrides: { expiresAt?: Date; status?: "PENDING" | "REVOKED" | "EXPIRED" } = {},
    ) {
      return prisma.invitation.create({
        data: {
          organizationId: orgA,
          normalizedEmail: inviteeEmail,
          role: "MODERATOR",
          tokenHash: createHash("sha256").update(raw).digest("hex"),
          expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
          status: overrides.status ?? "PENDING",
        },
      });
    }
    const valid = randomBytes(32).toString("base64url");
    await invitation(valid);
    await inviteeSession.agent
      .post("/invitations/accept")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", inviteeSession.csrf)
      .send({ token: valid })
      .expect(201);
    await inviteeSession.agent
      .post("/invitations/accept")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", inviteeSession.csrf)
      .send({ token: valid })
      .expect(409);
    await prisma.membership.delete({
      where: { organizationId_userId: { organizationId: orgA, userId: invitee.id } },
    });
    const expired = randomBytes(32).toString("base64url");
    await invitation(expired, { expiresAt: new Date(Date.now() - 1000), status: "EXPIRED" });
    await inviteeSession.agent
      .post("/invitations/accept")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", inviteeSession.csrf)
      .send({ token: expired })
      .expect(409);
    const revoked = randomBytes(32).toString("base64url");
    await invitation(revoked, { status: "REVOKED" });
    await inviteeSession.agent
      .post("/invitations/accept")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", inviteeSession.csrf)
      .send({ token: revoked })
      .expect(409);
    const wrong = randomBytes(32).toString("base64url");
    await prisma.invitation.create({
      data: {
        organizationId: orgA,
        normalizedEmail: `wrong-${suffix}@example.test`,
        role: "MODERATOR",
        tokenHash: createHash("sha256").update(wrong).digest("hex"),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await inviteeSession.agent
      .post("/invitations/accept")
      .set("Origin", "http://localhost:3000")
      .set("x-csrf-token", inviteeSession.csrf)
      .send({ token: wrong })
      .expect(404);
  }, 30_000);

  it("allows only one concurrent invitation acceptance and never audits raw tokens", async () => {
    const email = `race-${suffix}@example.test`;
    const raw = randomBytes(32).toString("base64url");
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: orgA,
        normalizedEmail: email,
        role: "MODERATOR",
        tokenHash: createHash("sha256").update(raw).digest("hex"),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const payload = { token: raw, email, displayName: "Race Invitee", password };
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post("/invitations/register")
        .set("Origin", "http://localhost:3000")
        .send(payload),
      request(app.getHttpServer())
        .post("/invitations/register")
        .set("Origin", "http://localhost:3000")
        .send(payload),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "invitation.accept", targetId: invitation.id },
    });
    expect(JSON.stringify(audit)).not.toContain(raw);
  }, 30_000);

  it("isolates tenant audit logs and exposes only safe integration metadata", async () => {
    const adminSession = await login(emails.admin);
    const audit = await adminSession.agent.get(`/organizations/${orgA}/audit-logs`).expect(200);
    expect(
      audit.body.items.every((item: { organizationId: string }) => item.organizationId === orgA),
    ).toBe(true);
    await adminSession.agent.get(`/organizations/${orgB}/audit-logs`).expect(404);
    const integrations = await adminSession.agent
      .get(`/organizations/${orgA}/integrations`)
      .expect(200);
    expect(integrations.body.providers).toEqual([
      "FACEBOOK_MESSENGER",
      "INSTAGRAM",
      "WHATSAPP_BUSINESS",
    ]);
    expect(JSON.stringify(integrations.body)).not.toContain("encryptedToken");
  });

  it("enforces role-scoped analytics and denies implicit Super Admin tenant access", async () => {
    await prisma.membership.update({
      where: { id: moderatorMembership },
      data: { role: "MODERATOR" },
    });
    const activeTeam = await prisma.team.create({
      data: {
        organizationId: orgA,
        name: `Analytics Team ${suffix}`,
        normalizedName: `analytics team ${suffix}`,
      },
    });
    await prisma.teamMembership.createMany({
      data: [
        {
          organizationId: orgA,
          teamId: activeTeam.id,
          membershipId: supervisorMembership,
        },
        {
          organizationId: orgA,
          teamId: activeTeam.id,
          membershipId: moderatorMembership,
        },
      ],
    });
    const adminSession = await login(emails.admin);
    const adminAnalytics = await adminSession.agent
      .get(`/organizations/${orgA}/analytics?preset=last7days`)
      .expect(200);
    expect(adminAnalytics.body.scope.kind).toBe("organization");
    await adminSession.agent.get(`/organizations/${orgB}/analytics`).expect(404);

    const supervisorSession = await login(emails.supervisor);
    const supervisorAnalytics = await supervisorSession.agent
      .get(`/organizations/${orgA}/analytics`)
      .expect(200);
    expect(supervisorAnalytics.body.scope.kind).toBe("teams");
    expect(supervisorAnalytics.body.scope.teamIds).toEqual([activeTeam.id]);
    expect(
      supervisorAnalytics.body.moderators.map(
        (item: { membershipId: string }) => item.membershipId,
      ),
    ).toEqual(expect.arrayContaining([supervisorMembership, moderatorMembership]));
    await supervisorSession.agent.get(`/organizations/${orgB}/analytics`).expect(404);

    const moderatorSession = await login(emails.moderator);
    const moderatorAnalytics = await moderatorSession.agent
      .get(`/organizations/${orgA}/analytics`)
      .expect(200);
    expect(moderatorAnalytics.body.scope.kind).toBe("self");
    expect(moderatorAnalytics.body.moderators).toHaveLength(1);
    expect(moderatorAnalytics.body.moderators[0].membershipId).toBe(moderatorMembership);
    await moderatorSession.agent.get(`/organizations/${orgB}/analytics`).expect(404);
    await moderatorSession.agent
      .get(`/organizations/${orgA}/analytics/moderators/${adminMembership}`)
      .expect(404);

    const superSession = await login(emails.super);
    await superSession.agent.get(`/organizations/${orgA}/analytics`).expect(404);
  });
});
