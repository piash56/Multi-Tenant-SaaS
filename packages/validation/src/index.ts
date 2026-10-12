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

export function parseCommaSeparatedUrls(value: string): string[] {
  const urls = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of urls) new URL(entry);
  return urls;
}
