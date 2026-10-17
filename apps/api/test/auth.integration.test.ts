import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { hash, argon2id } from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../src/database/prisma.service.js";
import { RedisService } from "../src/redis/redis.service.js";

const password = "Correct-Horse-42!";

function csrfFrom(response: request.Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[];
  const csrf = cookies.find((cookie) => cookie.startsWith("saas_csrf="));
  if (!csrf) throw new Error("CSRF cookie missing");
  return csrf.split(";", 1)[0]!.slice("saas_csrf=".length);
}

describe("Milestone 4 authentication and tenant isolation", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const suffix = randomUUID();
  const moderatorEmail = `moderator-${suffix}@example.test`;
  const superEmail = `super-${suffix}@example.test`;
  let orgA: string;
  let orgB: string;
  let conversationA: string;

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
    redis = app.get(RedisService);

    const passwordHash = await hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const [a, b] = await Promise.all([
      prisma.organization.create({ data: { name: "Auth tenant A", slug: `auth-a-${suffix}` } }),
      prisma.organization.create({ data: { name: "Auth tenant B", slug: `auth-b-${suffix}` } }),
    ]);
    orgA = a.id;
    orgB = b.id;
    const moderator = await prisma.user.create({
      data: {
        email: moderatorEmail,
        normalizedEmail: moderatorEmail,
        displayName: "Test Moderator",
        passwordHash,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgA,
        userId: moderator.id,
        role: "MODERATOR",
        status: "ACTIVE",
        displayName: "Test Moderator",
      },
    });
    await prisma.user.create({
      data: {
        email: superEmail,
        normalizedEmail: superEmail,
        displayName: "Test Super Admin",
        passwordHash,
        platformRole: "SUPER_ADMIN",
      },
    });
    const account = await prisma.connectedChannelAccount.create({
      data: {
        organizationId: orgA,
        platform: "FACEBOOK_MESSENGER",
        providerAccountId: `auth-account-${suffix}`,
        displayName: "Auth Account",
      },
    });
    const contact = await prisma.contact.create({
      data: { organizationId: orgA, displayName: "Auth Contact" },
    });
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: orgA,
        connectedChannelAccountId: account.id,
        contactId: contact.id,
        providerThreadKey: `auth-thread-${suffix}`,
      },
    });
    conversationA = conversation.id;
  }, 30_000);

  afterAll(async () => app?.close());

  beforeEach(async () => {
    await redis.client.del(
      `rate:auth:login:${Buffer.from(moderatorEmail).toString("base64url")}`,
      `rate:auth:login:${Buffer.from(superEmail).toString("base64url")}`,
    );
  });

  it("authenticates and returns the current user without exposing credentials", async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post("/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ email: moderatorEmail, password })
      .expect(200);
    expect(login.body.user).toMatchObject({ email: moderatorEmail, platformRole: "USER" });
    expect(JSON.stringify(login.body)).not.toContain("passwordHash");
    await agent.get("/auth/me").expect(200);
  });

  it("returns generic failures for invalid credentials and rejects missing credentials", async () => {
    const invalid = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: moderatorEmail, password: "Wrong-password-42!" })
      .expect(401);
    expect(invalid.body.message).toBe("Invalid email or password");
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("enforces tenant membership and tenant-scoped object lookup", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: moderatorEmail, password }).expect(200);
    await agent.get(`/organizations/${orgA}/context`).expect(200);
    await agent.get(`/organizations/${orgB}/context`).expect(404);
    await agent.get(`/organizations/${orgB}/conversations/${conversationA}`).expect(404);
  });

  it("prevents role escalation and client-supplied privilege properties", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: moderatorEmail, password }).expect(200);
    await agent.get("/platform/security-context").expect(403);
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: moderatorEmail, password, platformRole: "SUPER_ADMIN" })
      .expect(400);
    const superAgent = request.agent(app.getHttpServer());
    await superAgent.post("/auth/login").send({ email: superEmail, password }).expect(200);
    await superAgent.get("/platform/security-context").expect(200);
    await superAgent.get(`/organizations/${orgA}/context`).expect(404);
  });

  it("requires CSRF for cookie-authenticated mutations and revokes logout", async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post("/auth/login")
      .send({ email: moderatorEmail, password })
      .expect(200);
    await agent.post("/auth/logout").expect(403);
    await agent.post("/auth/logout").set("x-csrf-token", csrfFrom(login)).expect(204);
    await agent.get("/auth/me").expect(401);
  });

  it("rotates refresh tokens and detects replay", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: moderatorEmail, password })
      .expect(200);
    const firstCookies = login.headers["set-cookie"] as unknown as string[];
    const firstCsrf = csrfFrom(login);
    const rotated = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", firstCookies)
      .set("x-csrf-token", firstCsrf)
      .expect(200);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", firstCookies)
      .set("x-csrf-token", firstCsrf)
      .expect(401);
    const rotatedCookies = rotated.headers["set-cookie"] as unknown as string[];
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", rotatedCookies)
      .set("x-csrf-token", csrfFrom(rotated))
      .expect(401);
  });

  it("rejects disabled users and disabled memberships", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { normalizedEmail: moderatorEmail },
    });
    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: moderatorEmail, password })
      .expect(401);
    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: moderatorEmail, password }).expect(200);
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: orgA, userId: user.id } },
      data: { status: "SUSPENDED" },
    });
    await agent.get(`/organizations/${orgA}/context`).expect(404);
  });

  it("rejects expired sessions and rate limits repeated login attempts", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: superEmail, password }).expect(200);
    const superUser = await prisma.user.findUniqueOrThrow({
      where: { normalizedEmail: superEmail },
    });
    await prisma.authSession.updateMany({
      where: { userId: superUser.id, revokedAt: null },
      data: { expiresAt: new Date(0) },
    });
    await agent.get("/auth/me").expect(401);
    const email = `rate-${randomUUID()}@example.test`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(401);
    }
    await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(429);
  });
});
