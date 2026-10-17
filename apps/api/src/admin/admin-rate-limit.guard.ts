import { createHash } from "node:crypto";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class AdminMutationRateLimitGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const identity = `${request.ip ?? "unknown"}:${request.route?.path ?? request.path}`;
    const digest = createHash("sha256").update(identity).digest("base64url");
    const key = `rate:admin:mutation:${digest}`;
    if (this.redis.client.status === "wait") await this.redis.client.connect();
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, 60);
    if (count > 30) {
      throw new HttpException("Too many administrative attempts", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
