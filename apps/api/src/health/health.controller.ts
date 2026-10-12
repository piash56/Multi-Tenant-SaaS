import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { ReadinessHealth, ServiceHealth } from "@saas/shared-types";
import { PrismaService } from "../database/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { Public } from "../auth/auth.decorators.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RedisService)
    private readonly redis: RedisService,
  ) {}

  @Get("live")
  live(): ServiceHealth {
    return { status: "ok", service: "api", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async ready(): Promise<ReadinessHealth> {
    const [postgres, redis] = await Promise.allSettled([
      this.prisma.checkConnection(),
      this.redis.ping(),
    ]);
    const response: ReadinessHealth = {
      status: postgres.status === "fulfilled" && redis.status === "fulfilled" ? "ok" : "error",
      service: "api",
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: postgres.status === "fulfilled" ? "up" : "down",
        redis: redis.status === "fulfilled" ? "up" : "down",
      },
    };
    if (response.status === "error") throw new ServiceUnavailableException(response);
    return response;
  }
}
