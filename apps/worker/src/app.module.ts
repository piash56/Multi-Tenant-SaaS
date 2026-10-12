import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateWorkerEnvironment } from "./environment.js";
import { FOUNDATION_QUEUE, FoundationProcessor } from "./foundation.processor.js";
import { WorkerHealthService } from "./health.service.js";
import { StructuredLogger } from "./logger.service.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateWorkerEnvironment }),
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : 0,
      },
    }),
    BullModule.registerQueue({ name: FOUNDATION_QUEUE }),
  ],
  providers: [StructuredLogger, FoundationProcessor, WorkerHealthService],
})
export class WorkerModule {}
