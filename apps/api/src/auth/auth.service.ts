import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthenticatedPrincipal } from "./auth.types.js";
import { PasswordService } from "./password.service.js";

const ACCESS_COOKIE = "saas_access";
const REFRESH_COOKIE = "saas_refresh";
const CSRF_COOKIE = "saas_csrf";
const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;

interface AccessClaims {
  sub: string;
  sid: string;
  av: number;
}

interface ClientMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly issuer = process.env.AUTH_JWT_ISSUER!;
  private readonly audience = process.env.AUTH_JWT_AUDIENCE!;
  private readonly secureCookies = process.env.AUTH_COOKIE_SECURE === "true";

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(JwtService)
    private readonly jwt: JwtService,
    @Inject(PasswordService)
    private readonly passwords: PasswordService,
  ) {}

  async login(email: string, password: string, metadata: ClientMetadata) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail } });
    const valid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, password)
      : await this.passwords.verify(
          "$argon2id$v=19$m=65536,t=3,p=1$V3JvbmdQYXNzd29yZFNhbHQ$J1gI67CDndmFTrCZLjcp7PiEE9PAkzr5V8S9cMh7KGM",
          password,
        );
    if (!user || !valid || user.status !== "ACTIVE" || user.deletedAt) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const refreshToken = this.newOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_SECONDS * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        refreshTokens: {
          create: { tokenHash: this.hashToken(refreshToken), sequence: 1, expiresAt },
        },
      },
    });
    await this.audit(user.id, session.id, "auth.login", "SUCCESS");
    return {
      accessToken: await this.signAccess(user.id, session.id, session.accessVersion),
      refreshToken,
      csrfToken: this.newOpaqueToken(),
      user,
    };
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException("Authentication required");
    const tokenHash = this.hashToken(rawToken);
    const found = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash },
      include: { session: { include: { user: true } } },
    });
    const now = new Date();
    if (!found || found.expiresAt <= now || found.session.expiresAt <= now) {
      throw new UnauthorizedException("Authentication required");
    }
    if (found.usedAt || found.revokedAt || found.session.revokedAt) {
      await this.prisma.authSession.updateMany({
        where: { id: found.sessionId, revokedAt: null },
        data: { revokedAt: now, revokeReason: "REFRESH_REUSE", accessVersion: { increment: 1 } },
      });
      await this.audit(found.session.userId, found.sessionId, "auth.refresh_reuse", "DENIED");
      throw new UnauthorizedException("Authentication required");
    }
    if (found.session.user.status !== "ACTIVE" || found.session.user.deletedAt) {
      await this.revokeSession(found.sessionId, "USER_DISABLED");
      throw new UnauthorizedException("Authentication required");
    }

    const nextRaw = this.newOpaqueToken();
    const nextId = randomUUID();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authRefreshToken.updateMany({
        where: { id: found.id, usedAt: null, revokedAt: null },
        data: { usedAt: now, replacedById: nextId },
      });
      if (consumed.count !== 1) return false;
      await tx.authRefreshToken.create({
        data: {
          id: nextId,
          sessionId: found.sessionId,
          tokenHash: this.hashToken(nextRaw),
          sequence: found.sequence + 1,
          expiresAt: found.session.expiresAt,
        },
      });
      await tx.authSession.update({ where: { id: found.sessionId }, data: { lastUsedAt: now } });
      return true;
    });
    if (!rotated) {
      await this.revokeSession(found.sessionId, "REFRESH_REUSE");
      throw new UnauthorizedException("Authentication required");
    }
    return {
      accessToken: await this.signAccess(
        found.session.userId,
        found.sessionId,
        found.session.accessVersion,
      ),
      refreshToken: nextRaw,
      csrfToken: this.newOpaqueToken(),
    };
  }

  async authenticate(accessToken: string): Promise<AuthenticatedPrincipal> {
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(accessToken, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch {
      throw new UnauthorizedException("Authentication required");
    }
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.accessVersion !== claims.av ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE" ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException("Authentication required");
    }
    return {
      userId: session.userId,
      sessionId: session.id,
      platformRole: session.user.platformRole,
    };
  }

  async revokeSession(sessionId: string, reason = "LOGOUT"): Promise<void> {
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: now, revokeReason: reason, accessVersion: { increment: 1 } },
      }),
      this.prisma.authRefreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    if (session) await this.audit(session.userId, sessionId, "auth.session_revoke", reason);
  }

  setCookies(
    response: ExpressResponse,
    tokens: { accessToken: string; refreshToken: string; csrfToken: string },
  ): void {
    const common = { secure: this.secureCookies, sameSite: "lax" as const, path: "/" };
    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...common,
      httpOnly: true,
      maxAge: ACCESS_SECONDS * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...common,
      httpOnly: true,
      maxAge: REFRESH_SECONDS * 1000,
    });
    response.cookie(CSRF_COOKIE, tokens.csrfToken, {
      ...common,
      httpOnly: false,
      maxAge: REFRESH_SECONDS * 1000,
    });
  }

  clearCookies(response: ExpressResponse): void {
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
      response.clearCookie(name, { secure: this.secureCookies, sameSite: "lax", path: "/" });
    }
  }

  getAccessToken(request: ExpressRequest): string | undefined {
    const authorization = request.header("authorization");
    if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
    return request.cookies?.[ACCESS_COOKIE] as string | undefined;
  }

  getRefreshToken(request: ExpressRequest): string | undefined {
    return request.cookies?.[REFRESH_COOKIE] as string | undefined;
  }

  validCsrf(request: ExpressRequest): boolean {
    const cookie = request.cookies?.[CSRF_COOKIE] as string | undefined;
    const header = request.header("x-csrf-token");
    if (!cookie || !header) return false;
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private signAccess(userId: string, sessionId: string, accessVersion: number): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, av: accessVersion },
      {
        algorithm: "HS256",
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: ACCESS_SECONDS,
      },
    );
  }

  private newOpaqueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async audit(
    userId: string,
    sessionId: string,
    action: string,
    result: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action,
        targetType: "AUTH_SESSION",
        targetId: sessionId,
        result,
      },
    });
  }
}
