import { Injectable, type LoggerService } from "@nestjs/common";
import pino, { type Logger } from "pino";

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: ["password", "token", "authorization", "cookie"],
    base: { service: "worker" },
  });

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }
}
