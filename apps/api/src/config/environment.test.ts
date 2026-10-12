import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./environment.js";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
  REDIS_URL: "redis://localhost:6379",
  CORS_ORIGINS: "http://localhost:3000",
  AUTH_JWT_SECRET: "test-only-auth-secret-at-least-32-characters",
};

describe("validateEnvironment", () => {
  it("parses safe development configuration", () => {
    expect(validateEnvironment(valid)).toMatchObject({
      API_PORT: 3001,
      CORS_ORIGINS: ["http://localhost:3000"],
    });
  });

  it("rejects missing database configuration", () => {
    expect(() => validateEnvironment({ ...valid, DATABASE_URL: undefined })).toThrow();
  });

  it("rejects wildcard CORS as an invalid URL", () => {
    expect(() => validateEnvironment({ ...valid, CORS_ORIGINS: "*" })).toThrow();
  });
});
