import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { PrismaService } from "../database/prisma.service.js";
import { CurrentUser, Public } from "./auth.decorators.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedPrincipal } from "./auth.types.js";
// Runtime DTO metadata is required by Nest's ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from "./dto/login.dto.js";
import { LoginRateLimitGuard } from "./guards.js";
import { OriginGuard } from "./origin.guard.js";

@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Public()
  @UseGuards(LoginRateLimitGuard, OriginGuard)
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Authenticate and create a rotating browser session" })
  @ApiResponse({ status: 200, description: "Session cookies set" })
  @ApiResponse({ status: 401, description: "Invalid email or password" })
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.email, input.password, {
      ipAddress: request.ip ?? null,
      userAgent: request.header("user-agent") ?? null,
    });
    this.auth.setCookies(response, result);
    return this.userResponse(result.user.id);
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Atomically rotate the refresh credential" })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(this.auth.getRefreshToken(request));
    this.auth.setCookies(response, result);
    return { status: "refreshed" };
  }

  @UseGuards(OriginGuard)
  @Post("logout")
  @HttpCode(204)
  @ApiCookieAuth()
  async logout(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.revokeSession(user.sessionId);
    this.auth.clearCookies(response);
  }

  @Get("me")
  @ApiCookieAuth()
  current(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.userResponse(user.userId);
  }

  private async userResponse(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        platformRole: true,
        memberships: {
          where: { status: "ACTIVE", organization: { status: "ACTIVE" } },
          select: {
            id: true,
            organizationId: true,
            role: true,
            displayName: true,
            organization: { select: { name: true, slug: true } },
          },
        },
      },
    });
    return { user };
  }
}
