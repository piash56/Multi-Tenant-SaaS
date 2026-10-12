import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL is required");
    this.client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    this.client.on("error", () => undefined);
  }

  async ping(): Promise<void> {
    if (this.client.status === "wait") await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== "end")
      await this.client.quit().catch(() => this.client.disconnect());
  }
}
