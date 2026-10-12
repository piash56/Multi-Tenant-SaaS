import { describe, expect, it } from "vitest";
import { validateWorkerEnvironment } from "./environment.js";

describe("validateWorkerEnvironment", () => {
  it("accepts valid local dependencies", () => {
    expect(
      validateWorkerEnvironment({
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toMatchObject({ NODE_ENV: "development", LOG_LEVEL: "info" });
  });

  it("rejects non-Redis queue URLs", () => {
    expect(() =>
      validateWorkerEnvironment({
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        REDIS_URL: "https://example.com",
      }),
    ).toThrow();
  });
});
