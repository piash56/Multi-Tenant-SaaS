import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = new Set(
    (process.env.CORS_ORIGINS ?? "").split(",").map((value) => value.trim()),
  );

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.header("origin");
    if (!origin) return true;
    if (!this.allowed.has(origin)) throw new ForbiddenException("Origin not allowed");
    return true;
  }
}
