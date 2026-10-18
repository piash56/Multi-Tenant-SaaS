import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { TenantContext } from "../auth/auth.types.js";
import { AnalyticsRangePreset } from "./analytics.dto.js";
import type { AnalyticsQueryDto } from "./analytics.dto.js";

type Member = {
  id: string;
  displayName: string;
  role: "ORGANIZATION_ADMIN" | "SUPERVISOR" | "MODERATOR";
};
type Metric = {
  value: number | null;
  status: "available" | "unavailable";
  sampleSize?: number;
  unit?: "milliseconds";
};
type Performance = {
  membershipId: string;
  displayName: string;
  role: Member["role"];
  conversationsAssigned: Metric;
  conversationsReassigned: Metric;
  conversationsReassignedAway: Metric;
  currentPendingWorkload: Metric;
  repliesAuthored: Metric;
  conversationsResolved: Metric;
  conversationsReopened: Metric;
  assistedConversations: Metric;
  firstResponseTime: Metric;
  averageResponseTime: Metric;
  resolutionTime: Metric;
  ranks: { replies: number | null; resolved: number | null; responseTime: number | null };
};

const available = (value: number, sampleSize?: number): Metric => ({
  value,
  status: "available",
  ...(sampleSize === undefined ? {} : { sampleSize }),
});
const duration = (total: number, count: number): Metric => ({
  value: count ? Math.round(total / count) : null,
  status: "available",
  sampleSize: count,
  unit: "milliseconds",
});

const MESSAGE_PAGE_SIZE = 1_000;

function dateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function zonedMidnightUtc(year: number, month: number, day: number, timezone: string): Date {
  let guess = Date.UTC(year, month - 1, day);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    guess += Date.UTC(year, month - 1, day) - represented;
  }
  return new Date(guess);
}

function plusDays(parts: { year: number; month: number; day: number }, days: number) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException("Custom dates must use YYYY-MM-DD");
  const result = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const checked = new Date(Date.UTC(result.year, result.month - 1, result.day));
  if (
    checked.getUTCFullYear() !== result.year ||
    checked.getUTCMonth() + 1 !== result.month ||
    checked.getUTCDate() !== result.day
  )
    throw new BadRequestException("Custom date is invalid");
  return result;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview(tenant: TenantContext, query: AnalyticsQueryDto) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { timezone: true },
    });
    if (!organization) throw new NotFoundException("Resource not found");
    const range = this.range(query, organization.timezone);
    const scope = await this.scope(tenant, query.teamId);
    const performance = await this.calculate(
      tenant.organizationId,
      scope.members,
      range.start,
      range.end,
    );
    return {
      range: {
        preset: query.preset,
        from: range.start.toISOString(),
        toExclusive: range.end.toISOString(),
        timezone: organization.timezone,
      },
      scope: { kind: scope.kind, teamIds: scope.teamIds },
      definitionsVersion: 1,
      organization: this.total(performance),
      moderators: performance,
      leaderboard: performance
        .map((item) => ({
          membershipId: item.membershipId,
          displayName: item.displayName,
          repliesAuthored: item.repliesAuthored.value,
          conversationsResolved: item.conversationsResolved.value,
          averageResponseTime: item.averageResponseTime,
          ranks: item.ranks,
        }))
        .sort(
          (a, b) =>
            (a.ranks.replies ?? Number.MAX_SAFE_INTEGER) -
            (b.ranks.replies ?? Number.MAX_SAFE_INTEGER),
        ),
      teams: await this.teamPerformance(tenant, query.teamId, performance),
    };
  }

  async detail(tenant: TenantContext, membershipId: string, query: AnalyticsQueryDto) {
    const overview = await this.overview(tenant, query);
    const moderator = overview.moderators.find((item) => item.membershipId === membershipId);
    if (!moderator) throw new NotFoundException("Resource not found");
    return { range: overview.range, scope: overview.scope, definitionsVersion: 1, moderator };
  }

  private range(query: AnalyticsQueryDto, timezone: string) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException("The organization timezone is invalid");
    }
    const today = dateParts(new Date(), timezone);
    let first = today;
    let last = today;
    if (query.preset === AnalyticsRangePreset.LAST_7_DAYS) first = plusDays(today, -6);
    if (query.preset === AnalyticsRangePreset.LAST_30_DAYS) first = plusDays(today, -29);
    if (query.preset === AnalyticsRangePreset.CUSTOM) {
      if (!query.from || !query.to)
        throw new BadRequestException("Custom ranges require from and to dates");
      first = parseDay(query.from.slice(0, 10));
      last = parseDay(query.to.slice(0, 10));
      if (
        Date.UTC(first.year, first.month - 1, first.day) >
        Date.UTC(last.year, last.month - 1, last.day)
      )
        throw new BadRequestException("The from date must not be after the to date");
      if (
        (Date.UTC(last.year, last.month - 1, last.day) -
          Date.UTC(first.year, first.month - 1, first.day)) /
          86_400_000 >
        365
      )
        throw new BadRequestException("Custom ranges cannot exceed 366 days");
    }
    const afterLast = plusDays(last, 1);
    return {
      start: zonedMidnightUtc(first.year, first.month, first.day, timezone),
      end: zonedMidnightUtc(afterLast.year, afterLast.month, afterLast.day, timezone),
    };
  }

  private async scope(tenant: TenantContext, requestedTeamId?: string) {
    if (tenant.membershipRole === "MODERATOR") {
      if (requestedTeamId)
        throw new ForbiddenException("Moderators can only view personal analytics");
      const member = await this.prisma.membership.findUnique({
        where: {
          organizationId_id: { organizationId: tenant.organizationId, id: tenant.membershipId },
        },
        select: { id: true, displayName: true, role: true },
      });
      return { kind: "self" as const, teamIds: [] as string[], members: member ? [member] : [] };
    }
    let allowedTeamIds: string[] | undefined;
    if (tenant.membershipRole === "SUPERVISOR") {
      const rows = await this.prisma.teamMembership.findMany({
        where: {
          organizationId: tenant.organizationId,
          membershipId: tenant.membershipId,
          team: { isActive: true },
        },
        select: { teamId: true },
      });
      allowedTeamIds = rows.map((row) => row.teamId);
      if (requestedTeamId && !allowedTeamIds.includes(requestedTeamId))
        throw new NotFoundException("Resource not found");
    }
    const teamIds = requestedTeamId ? [requestedTeamId] : allowedTeamIds;
    const members = await this.prisma.membership.findMany({
      where: {
        organizationId: tenant.organizationId,
        status: "ACTIVE",
        role: { in: ["SUPERVISOR", "MODERATOR"] },
        ...(teamIds ? { teamMemberships: { some: { teamId: { in: teamIds } } } } : {}),
      },
      select: { id: true, displayName: true, role: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
    return {
      kind:
        tenant.membershipRole === "ORGANIZATION_ADMIN"
          ? ("organization" as const)
          : ("teams" as const),
      teamIds: teamIds ?? [],
      members,
    };
  }

  private async calculate(
    organizationId: string,
    members: Member[],
    start: Date,
    end: Date,
  ): Promise<Performance[]> {
    const ids = members.map((member) => member.id);
    const [assignments, conversations, resolutions] = await Promise.all([
      this.prisma.conversationAssignmentEvent.findMany({
        where: {
          organizationId,
          occurredAt: { gte: start, lt: end },
          OR: [{ toMembershipId: { in: ids } }, { fromMembershipId: { in: ids } }],
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      }),
      this.prisma.conversation.findMany({
        where: { organizationId },
        select: { id: true, createdAt: true, status: true, currentAssigneeMembershipId: true },
      }),
      this.prisma.conversationResolutionEvent.findMany({
        where: { organizationId, occurredAt: { lt: end } },
        orderBy: [{ conversationId: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const stats = new Map(
      ids.map((id) => [
        id,
        {
          assigned: 0,
          reassigned: 0,
          reassignedAway: 0,
          pending: 0,
          replies: 0,
          reopened: 0,
          assisted: new Set<string>(),
          resolved: 0,
          firstTotal: 0,
          firstCount: 0,
          responseTotal: 0,
          responseCount: 0,
          resolutionTotal: 0,
          resolutionCount: 0,
        },
      ]),
    );
    for (const event of assignments) {
      if (event.toMembershipId && stats.has(event.toMembershipId)) {
        stats.get(event.toMembershipId)!.assigned += 1;
        if (event.fromMembershipId && event.fromMembershipId !== event.toMembershipId)
          stats.get(event.toMembershipId)!.reassigned += 1;
      }
      if (
        event.fromMembershipId &&
        event.fromMembershipId !== event.toMembershipId &&
        stats.has(event.fromMembershipId)
      )
        stats.get(event.fromMembershipId)!.reassignedAway += 1;
    }
    for (const conversation of conversations)
      if (
        conversation.status === "OPEN" &&
        conversation.currentAssigneeMembershipId &&
        stats.has(conversation.currentAssigneeMembershipId)
      )
        stats.get(conversation.currentAssigneeMembershipId)!.pending += 1;
    const responseState = new Map<string, { pendingInbound: Date | undefined; isFirst: boolean }>();
    let cursor: string | undefined;
    do {
      const messages = await this.prisma.message.findMany({
        where: {
          organizationId,
          createdAt: { lt: end },
          OR: [
            { direction: "INBOUND", origin: "EXTERNAL" },
            { direction: "OUTBOUND", origin: "HUMAN" },
          ],
        },
        select: {
          id: true,
          conversationId: true,
          direction: true,
          origin: true,
          authorMembershipId: true,
          assigneeAtSendMembershipId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MESSAGE_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const message of messages) {
        const state = responseState.get(message.conversationId) ?? {
          pendingInbound: undefined,
          isFirst: true,
        };
        if (
          message.createdAt >= start &&
          message.direction === "OUTBOUND" &&
          message.origin === "HUMAN" &&
          message.authorMembershipId &&
          stats.has(message.authorMembershipId)
        ) {
          const item = stats.get(message.authorMembershipId)!;
          item.replies += 1;
          if (
            message.assigneeAtSendMembershipId &&
            message.assigneeAtSendMembershipId !== message.authorMembershipId
          )
            item.assisted.add(message.conversationId);
        }
        if (message.direction === "INBOUND" && message.origin === "EXTERNAL")
          state.pendingInbound ??= message.createdAt;
        if (
          state.pendingInbound &&
          message.direction === "OUTBOUND" &&
          message.origin === "HUMAN" &&
          message.authorMembershipId
        ) {
          if (message.createdAt >= start && stats.has(message.authorMembershipId)) {
            const elapsed = message.createdAt.getTime() - state.pendingInbound.getTime();
            const item = stats.get(message.authorMembershipId)!;
            item.responseTotal += elapsed;
            item.responseCount += 1;
            if (state.isFirst) {
              item.firstTotal += elapsed;
              item.firstCount += 1;
            }
          }
          state.pendingInbound = undefined;
          state.isFirst = false;
        }
        responseState.set(message.conversationId, state);
      }
      cursor = messages.at(-1)?.id;
      if (messages.length < MESSAGE_PAGE_SIZE) cursor = undefined;
    } while (cursor);
    const created = new Map(
      conversations.map((conversation) => [conversation.id, conversation.createdAt]),
    );
    const state = new Map<string, { open: boolean; openedAt: Date }>();
    for (const event of resolutions) {
      const current = state.get(event.conversationId) ?? {
        open: true,
        openedAt: created.get(event.conversationId) ?? event.occurredAt,
      };
      if (event.action === "RESOLVED" && current.open) {
        if (
          event.occurredAt >= start &&
          event.completionCreditMembershipId &&
          stats.has(event.completionCreditMembershipId)
        ) {
          const item = stats.get(event.completionCreditMembershipId)!;
          item.resolved += 1;
          item.resolutionTotal += event.occurredAt.getTime() - current.openedAt.getTime();
          item.resolutionCount += 1;
        }
        current.open = false;
      } else if (event.action === "REOPENED" && !current.open) {
        if (
          event.occurredAt >= start &&
          event.actorMembershipId &&
          stats.has(event.actorMembershipId)
        )
          stats.get(event.actorMembershipId)!.reopened += 1;
        current.open = true;
        current.openedAt = event.occurredAt;
      }
      state.set(event.conversationId, current);
    }
    const result = members.map((member): Performance => {
      const item = stats.get(member.id)!;
      return {
        membershipId: member.id,
        displayName: member.displayName,
        role: member.role,
        conversationsAssigned: available(item.assigned),
        conversationsReassigned: available(item.reassigned),
        conversationsReassignedAway: available(item.reassignedAway),
        currentPendingWorkload: available(item.pending),
        repliesAuthored: available(item.replies),
        conversationsResolved: available(item.resolved),
        conversationsReopened: available(item.reopened),
        assistedConversations: available(item.assisted.size),
        firstResponseTime: duration(item.firstTotal, item.firstCount),
        averageResponseTime: duration(item.responseTotal, item.responseCount),
        resolutionTime: duration(item.resolutionTotal, item.resolutionCount),
        ranks: { replies: null, resolved: null, responseTime: null },
      };
    });
    this.rank(result, "repliesAuthored", "replies", "desc");
    this.rank(result, "conversationsResolved", "resolved", "desc");
    this.rank(result, "averageResponseTime", "responseTime", "asc", true);
    return result;
  }

  private rank(
    items: Performance[],
    metric: keyof Performance,
    rank: keyof Performance["ranks"],
    direction: "asc" | "desc",
    requireSample = false,
  ) {
    const eligible = items
      .filter((item) => !requireSample || ((item[metric] as Metric).sampleSize ?? 0) > 0)
      .sort((a, b) => {
        const av = (a[metric] as Metric).value ?? 0;
        const bv = (b[metric] as Metric).value ?? 0;
        return (
          (direction === "asc" ? av - bv : bv - av) ||
          a.displayName.localeCompare(b.displayName) ||
          a.membershipId.localeCompare(b.membershipId)
        );
      });
    eligible.forEach((item, index) => {
      item.ranks[rank] = index + 1;
    });
  }

  private total(items: Performance[]) {
    const sum = (key: keyof Performance) =>
      items.reduce((total, item) => total + ((item[key] as Metric).value ?? 0), 0);
    const weighted = (key: "firstResponseTime" | "averageResponseTime" | "resolutionTime") => {
      const count = items.reduce((total, item) => total + (item[key].sampleSize ?? 0), 0);
      const total = items.reduce(
        (value, item) => value + (item[key].value ?? 0) * (item[key].sampleSize ?? 0),
        0,
      );
      return duration(total, count);
    };
    return {
      conversationsAssigned: available(sum("conversationsAssigned")),
      conversationsReassigned: available(sum("conversationsReassigned")),
      conversationsReassignedAway: available(sum("conversationsReassignedAway")),
      currentPendingWorkload: available(sum("currentPendingWorkload")),
      repliesAuthored: available(sum("repliesAuthored")),
      conversationsResolved: available(sum("conversationsResolved")),
      conversationsReopened: available(sum("conversationsReopened")),
      assistedConversations: available(sum("assistedConversations")),
      firstResponseTime: weighted("firstResponseTime"),
      averageResponseTime: weighted("averageResponseTime"),
      resolutionTime: weighted("resolutionTime"),
    };
  }

  private async teamPerformance(
    tenant: TenantContext,
    requestedTeamId: string | undefined,
    performance: Performance[],
  ) {
    if (tenant.membershipRole === "MODERATOR") return [];
    const visible = new Map(performance.map((item) => [item.membershipId, item]));
    const teams = await this.prisma.team.findMany({
      where: {
        organizationId: tenant.organizationId,
        isActive: true,
        ...(requestedTeamId ? { id: requestedTeamId } : {}),
        ...(tenant.membershipRole === "SUPERVISOR"
          ? { memberships: { some: { membershipId: tenant.membershipId } } }
          : {}),
      },
      select: { id: true, name: true, memberships: { select: { membershipId: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      members: team.memberships.filter((row) => visible.has(row.membershipId)).length,
      metrics: this.total(team.memberships.flatMap((row) => visible.get(row.membershipId) ?? [])),
    }));
  }
}
