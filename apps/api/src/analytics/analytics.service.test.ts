import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "./analytics.service.js";

const adminTenant = {
  userId: "user-admin",
  sessionId: "session",
  platformRole: "USER" as const,
  organizationId: "org-a",
  membershipId: "admin",
  membershipRole: "ORGANIZATION_ADMIN" as const,
  permissions: ["analytics.self", "analytics.team"] as const,
};
const at = (value: string) => new Date(`${value}Z`);
const members = [
  { id: "alice", displayName: "Alice", role: "MODERATOR" as const },
  { id: "bob", displayName: "Bob", role: "MODERATOR" as const },
];
type Row = Record<string, unknown>;

function fixture(
  overrides: {
    timezone?: string;
    members?: typeof members;
    assignments?: Row[];
    conversations?: Row[];
    messages?: Row[];
    resolutions?: Row[];
  } = {},
) {
  const assignments = overrides.assignments ?? [];
  const messages = overrides.messages ?? [];
  const resolutions = overrides.resolutions ?? [];
  return {
    organization: { findUnique: async () => ({ timezone: overrides.timezone ?? "UTC" }) },
    membership: { findMany: async () => overrides.members ?? members },
    conversationAssignmentEvent: {
      findMany: async ({ where }: { where: { occurredAt: { gte: Date; lt: Date } } }) =>
        assignments.filter(
          (row) => row.occurredAt! >= where.occurredAt.gte && row.occurredAt! < where.occurredAt.lt,
        ),
    },
    conversation: { findMany: async () => overrides.conversations ?? [] },
    message: {
      findMany: async ({ where }: { where: { createdAt: { lt: Date } } }) =>
        messages.filter((row) => row.createdAt! < where.createdAt.lt),
    },
    conversationResolutionEvent: {
      findMany: async ({ where }: { where: { occurredAt: { lt: Date } } }) =>
        resolutions.filter((row) => row.occurredAt! < where.occurredAt.lt),
    },
    team: { findMany: async () => [] },
  };
}

async function overview(data: ReturnType<typeof fixture>, from = "2026-10-10", to = "2026-10-12") {
  return new AnalyticsService(data as never).overview(adminTenant, {
    preset: "custom" as never,
    from,
    to,
  });
}

afterEach(() => vi.useRealTimers());

describe("AnalyticsService assignment history", () => {
  it("counts initial assignment, reassignments received/away, unassignment, and same-member events", async () => {
    const result = await overview(
      fixture({
        assignments: [
          {
            id: "initial",
            fromMembershipId: null,
            toMembershipId: "alice",
            occurredAt: at("2026-10-10T00:00:00"),
          },
          {
            id: "to-bob",
            fromMembershipId: "alice",
            toMembershipId: "bob",
            occurredAt: at("2026-10-10T01:00:00"),
          },
          {
            id: "back-alice",
            fromMembershipId: "bob",
            toMembershipId: "alice",
            occurredAt: at("2026-10-10T02:00:00"),
          },
          {
            id: "same",
            fromMembershipId: "alice",
            toMembershipId: "alice",
            occurredAt: at("2026-10-10T03:00:00"),
          },
          {
            id: "unassign",
            fromMembershipId: "alice",
            toMembershipId: null,
            occurredAt: at("2026-10-10T04:00:00"),
          },
        ],
      }),
    );
    const alice = result.moderators.find((item) => item.membershipId === "alice")!;
    const bob = result.moderators.find((item) => item.membershipId === "bob")!;
    expect([
      alice.conversationsAssigned.value,
      alice.conversationsReassigned.value,
      alice.conversationsReassignedAway.value,
    ]).toEqual([3, 1, 2]);
    expect([
      bob.conversationsAssigned.value,
      bob.conversationsReassigned.value,
      bob.conversationsReassignedAway.value,
    ]).toEqual([1, 1, 1]);
  });

  it("uses a half-open reporting range for assignment events", async () => {
    const result = await overview(
      fixture({
        assignments: [
          {
            id: "start",
            fromMembershipId: null,
            toMembershipId: "alice",
            occurredAt: at("2026-10-10T00:00:00"),
          },
          {
            id: "last",
            fromMembershipId: null,
            toMembershipId: "alice",
            occurredAt: at("2026-10-12T23:59:59.999"),
          },
          {
            id: "end",
            fromMembershipId: null,
            toMembershipId: "alice",
            occurredAt: at("2026-10-13T00:00:00"),
          },
        ],
      }),
    );
    expect(result.moderators[0]?.conversationsAssigned.value).toBe(2);
  });
});

describe("AnalyticsService resolution transitions", () => {
  it("ignores duplicate transitions and attributes repeated resolve/reopen cycles once", async () => {
    const result = await overview(
      fixture({
        conversations: [
          {
            id: "c1",
            createdAt: at("2026-10-10T00:00:00"),
            status: "RESOLVED",
            currentAssigneeMembershipId: "bob",
          },
        ],
        resolutions: [
          {
            id: "r1",
            conversationId: "c1",
            action: "RESOLVED",
            actorMembershipId: "alice",
            completionCreditMembershipId: "bob",
            occurredAt: at("2026-10-10T01:00:00"),
          },
          {
            id: "r1-duplicate",
            conversationId: "c1",
            action: "RESOLVED",
            actorMembershipId: "alice",
            completionCreditMembershipId: "alice",
            occurredAt: at("2026-10-10T02:00:00"),
          },
          {
            id: "open1",
            conversationId: "c1",
            action: "REOPENED",
            actorMembershipId: "alice",
            completionCreditMembershipId: null,
            occurredAt: at("2026-10-10T03:00:00"),
          },
          {
            id: "open1-duplicate",
            conversationId: "c1",
            action: "REOPENED",
            actorMembershipId: "bob",
            completionCreditMembershipId: null,
            occurredAt: at("2026-10-10T04:00:00"),
          },
          {
            id: "r2",
            conversationId: "c1",
            action: "RESOLVED",
            actorMembershipId: "bob",
            completionCreditMembershipId: "alice",
            occurredAt: at("2026-10-10T05:00:00"),
          },
          {
            id: "open2",
            conversationId: "c1",
            action: "REOPENED",
            actorMembershipId: "bob",
            completionCreditMembershipId: null,
            occurredAt: at("2026-10-10T06:00:00"),
          },
          {
            id: "r3",
            conversationId: "c1",
            action: "RESOLVED",
            actorMembershipId: "alice",
            completionCreditMembershipId: "bob",
            occurredAt: at("2026-10-10T07:00:00"),
          },
        ],
      }),
    );
    const alice = result.moderators.find((item) => item.membershipId === "alice")!;
    const bob = result.moderators.find((item) => item.membershipId === "bob")!;
    expect([alice.conversationsResolved.value, bob.conversationsResolved.value]).toEqual([1, 2]);
    expect([alice.conversationsReopened.value, bob.conversationsReopened.value]).toEqual([1, 1]);
    expect(result.organization.conversationsResolved.value).toBe(3);
  });

  it("keeps valid resolutions uncredited when completion credit is absent", async () => {
    const result = await overview(
      fixture({
        conversations: [
          {
            id: "c1",
            createdAt: at("2026-10-10T00:00:00"),
            status: "RESOLVED",
            currentAssigneeMembershipId: null,
          },
        ],
        resolutions: [
          {
            id: "r1",
            conversationId: "c1",
            action: "RESOLVED",
            actorMembershipId: "alice",
            completionCreditMembershipId: null,
            occurredAt: at("2026-10-10T01:00:00"),
          },
        ],
      }),
    );
    expect(result.organization.conversationsResolved.value).toBe(0);
    expect(result.organization.resolutionTime).toMatchObject({ value: null, sampleSize: 0 });
  });
});

describe("AnalyticsService calendar ranges", () => {
  it.each([
    ["today", "2026-03-10T04:00:00.000Z", "2026-03-11T04:00:00.000Z"],
    ["last7days", "2026-03-04T05:00:00.000Z", "2026-03-11T04:00:00.000Z"],
    ["last30days", "2026-02-09T05:00:00.000Z", "2026-03-11T04:00:00.000Z"],
  ])(
    "calculates %s in America/New_York across spring-forward",
    async (preset, from, toExclusive) => {
      vi.useFakeTimers();
      vi.setSystemTime(at("2026-03-10T12:00:00"));
      const result = await new AnalyticsService(
        fixture({ timezone: "America/New_York" }) as never,
      ).overview(adminTenant, { preset: preset as never });
      expect(result.range).toMatchObject({ from, toExclusive, timezone: "America/New_York" });
    },
  );

  it("uses inclusive custom Asia/Dhaka dates with an exclusive UTC end", async () => {
    const result = await overview(fixture({ timezone: "Asia/Dhaka" }), "2026-10-19", "2026-10-19");
    expect(result.range.from).toBe("2026-10-18T18:00:00.000Z");
    expect(result.range.toExclusive).toBe("2026-10-19T18:00:00.000Z");
  });

  it("covers the 25-hour America/New_York fall-back calendar date", async () => {
    const result = await overview(
      fixture({ timezone: "America/New_York" }),
      "2026-11-01",
      "2026-11-01",
    );
    expect(result.range.from).toBe("2026-11-01T04:00:00.000Z");
    expect(result.range.toExclusive).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("AnalyticsService leaderboard and empty data", () => {
  it("uses sequential ranks for equal values, then display name and membership ID", async () => {
    const tiedMembers = [
      { id: "member-b", displayName: "Same", role: "MODERATOR" as const },
      { id: "member-a", displayName: "Same", role: "MODERATOR" as const },
      { id: "member-z", displayName: "Zed", role: "MODERATOR" as const },
    ];
    const messages = tiedMembers.flatMap((member, index) => [
      {
        id: `in-${index}`,
        conversationId: `c-${index}`,
        direction: "INBOUND",
        origin: "EXTERNAL",
        authorMembershipId: null,
        assigneeAtSendMembershipId: null,
        createdAt: at(`2026-10-10T0${index}:00:00`),
      },
      {
        id: `out-${index}`,
        conversationId: `c-${index}`,
        direction: "OUTBOUND",
        origin: "HUMAN",
        authorMembershipId: member.id,
        assigneeAtSendMembershipId: member.id,
        createdAt: at(`2026-10-10T0${index}:01:00`),
      },
    ]);
    const conversations = tiedMembers.map((_, index) => ({
      id: `c-${index}`,
      createdAt: at(`2026-10-10T0${index}:00:00`),
      status: "RESOLVED",
      currentAssigneeMembershipId: null,
    }));
    const resolutions = tiedMembers.map((member, index) => ({
      id: `r-${index}`,
      conversationId: `c-${index}`,
      action: "RESOLVED",
      actorMembershipId: member.id,
      completionCreditMembershipId: member.id,
      occurredAt: at(`2026-10-10T0${index}:02:00`),
    }));
    const result = await overview(
      fixture({ members: tiedMembers, messages, conversations, resolutions }),
    );
    expect(result.leaderboard.map((item) => [item.membershipId, item.ranks])).toEqual([
      ["member-a", { replies: 1, resolved: 1, responseTime: 1 }],
      ["member-b", { replies: 2, resolved: 2, responseTime: 2 }],
      ["member-z", { replies: 3, resolved: 3, responseTime: 3 }],
    ]);
  });

  it("reports zero activity and missing response samples distinctly", async () => {
    const result = await overview(fixture());
    expect(result.organization.repliesAuthored.value).toBe(0);
    expect(result.organization.averageResponseTime).toMatchObject({
      value: null,
      status: "available",
      sampleSize: 0,
    });
    expect(result.leaderboard.every((item) => item.ranks.responseTime === null)).toBe(true);
  });
});
