import { parseCommaSeparatedUrls } from "@saas/validation";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  REDIS_URL: z.url().startsWith("redis://"),
  CORS_ORIGINS: z.string().min(1).transform(parseCommaSeparatedUrls),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
