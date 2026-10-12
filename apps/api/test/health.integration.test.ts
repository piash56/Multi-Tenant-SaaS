import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("health API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL ??=
      "postgresql://saas_app:local-development-only@localhost:5433/saas_dev";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.CORS_ORIGINS ??= "http://localhost:3000";
    const { createApplication } = await import("../src/bootstrap.js");
    app = await createApplication();
    await app.init();
  }, 30_000);

  afterAll(async () => app?.close());

  it("returns liveness without depending on PostgreSQL or Redis state", async () => {
    const response = await request(app.getHttpServer()).get("/health/live").expect(200);
    expect(response.body).toMatchObject({ status: "ok", service: "api" });
  });

  it("returns readiness when PostgreSQL and Redis are reachable", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      dependencies: { postgres: "up", redis: "up" },
    });
  });
});
