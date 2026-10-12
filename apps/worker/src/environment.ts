import { z } from "zod";

const workerEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().startsWith("postgresql://"),
  REDIS_URL: z.url().startsWith("redis://"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function validateWorkerEnvironment(input: Record<string, unknown>): WorkerEnvironment {
  return workerEnvironmentSchema.parse(input);
}
