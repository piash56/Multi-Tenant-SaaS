import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import type { ReadinessHealth } from "@saas/shared-types";
import { Redis } from "ioredis";
import { Pool } from "pg";

@Injectable()
export class WorkerHealthService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHealthService.name);
  private readonly database = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  private readonly redis = new Redis(process.env.REDIS_URL!, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  constructor() {
    this.redis.on("error", () => undefined);
  }

  async status(): Promise<ReadinessHealth> {
    const [postgres, redis] = await Promise.allSettled([
      this.database.query("SELECT 1"),
      this.pingRedis(),
    ]);
    return {
      status: postgres.status === "fulfilled" && redis.status === "fulfilled" ? "ok" : "error",
      service: "worker",
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: postgres.status === "fulfilled" ? "up" : "down",
        redis: redis.status === "fulfilled" ? "up" : "down",
      },
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(`Worker foundation readiness ${JSON.stringify(await this.status())}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.database.end();
    if (this.redis.status !== "end") await this.redis.quit().catch(() => this.redis.disconnect());
  }

  private async pingRedis(): Promise<void> {
    if (this.redis.status === "wait") await this.redis.connect();
    await this.redis.ping();
  }
}
