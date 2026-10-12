import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { validateEnvironment } from "./config/environment.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        genReqId: (request) => request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
        redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
      },
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    RealtimeModule,
  ],
})
export class AppModule {}
