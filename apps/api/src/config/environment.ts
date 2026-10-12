import { parseCommaSeparatedUrls } from "@saas/validation";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  REDIS_URL: z.url().startsWith("redis://"),
  CORS_ORIGINS: z.string().min(1).transform(parseCommaSeparatedUrls),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_ISSUER: z.string().min(3).default("unified-inbox-api"),
  AUTH_JWT_AUDIENCE: z.string().min(3).default("unified-inbox-clients"),
  AUTH_COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  SWAGGER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
