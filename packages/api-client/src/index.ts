import { apiPaths, serviceDefaults } from "@saas/config";
import type {
  AuditEntry,
  AuthResponse,
  IntegrationAccountSummary,
  InvitationSummary,
  MembershipRole,
  MembershipStatus,
  MembershipSummary,
  OrganizationContextResponse,
  OrganizationStatus,
  OrganizationSummary,
  PageResponse,
  PlatformOverviewResponse,
  ReadinessHealth,
  ServiceHealth,
  TeamSummary,
  UserStatus,
  UserSummary,
} from "@saas/shared-types";
import {
  authResponseSchema,
  healthSchema,
  organizationContextSchema,
  readinessSchema,
} from "@saas/validation";

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export class ApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  #refreshPromise: Promise<boolean> | undefined;

  constructor(options: ApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? serviceDefaults.apiUrl).replace(/\/$/, "");
    // Browser fetch is a host method and some runtimes require its receiver to
    // remain the global object. Calling an unbound copy can throw synchronously
    // before a request reaches the Network panel.
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getLiveness(): Promise<ServiceHealth> {
    return this.#validatedRequest(apiPaths.live, healthSchema, { auth: false });
  }

  async getReadiness(): Promise<ReadinessHealth> {
    return this.#validatedRequest(apiPaths.ready, readinessSchema, { auth: false });
  }

  login(email: string, password: string): Promise<AuthResponse> {
    return this.#validatedRequest("/auth/login", authResponseSchema, {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  }

  getCurrentUser(): Promise<AuthResponse> {
    return this.#validatedRequest("/auth/me", authResponseSchema);
  }

  async logout(): Promise<void> {
    await this.#request("/auth/logout", { method: "POST", retryAuth: false });
  }

  getOrganizationContext(organizationId: string): Promise<OrganizationContextResponse> {
    return this.#validatedRequest(
      `/organizations/${encodeURIComponent(organizationId)}/context`,
      organizationContextSchema,
    );
  }

  getPlatformOverview(): Promise<PlatformOverviewResponse> {
    return this.#request("/platform/overview") as Promise<PlatformOverviewResponse>;
  }

  listPlatformOrganizations(query = ""): Promise<PageResponse<OrganizationSummary>> {
    return this.#request(`/platform/organizations${query ? `?${query}` : ""}`) as Promise<
      PageResponse<OrganizationSummary>
    >;
  }

  createPlatformOrganization(input: {
    name: string;
    slug: string;
    timezone?: string;
  }): Promise<{ organization: OrganizationSummary }> {
    return this.#request("/platform/organizations", { method: "POST", body: input }) as Promise<{
      organization: OrganizationSummary;
    }>;
  }

  getPlatformOrganization(id: string): Promise<{ organization: OrganizationSummary }> {
    return this.#request(`/platform/organizations/${encodeURIComponent(id)}`) as Promise<{
      organization: OrganizationSummary;
    }>;
  }

  updatePlatformOrganization(
    id: string,
    input: { name?: string; timezone?: string },
  ): Promise<{ organization: OrganizationSummary }> {
    return this.#request(`/platform/organizations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }) as Promise<{ organization: OrganizationSummary }>;
  }

  setPlatformOrganizationStatus(
    id: string,
    status: OrganizationStatus,
  ): Promise<{ organization: OrganizationSummary }> {
    return this.#request(`/platform/organizations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }) as Promise<{ organization: OrganizationSummary }>;
  }

  listPlatformUsers(query = ""): Promise<PageResponse<UserSummary>> {
    return this.#request(`/platform/users${query ? `?${query}` : ""}`) as Promise<
      PageResponse<UserSummary>
    >;
  }

  getPlatformUser(id: string): Promise<{ user: UserSummary }> {
    return this.#request(`/platform/users/${encodeURIComponent(id)}`) as Promise<{
      user: UserSummary;
    }>;
  }

  setPlatformUserStatus(id: string, status: UserStatus): Promise<{ user: UserSummary }> {
    return this.#request(`/platform/users/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }) as Promise<{ user: UserSummary }>;
  }

  listPlatformAudit(query = ""): Promise<PageResponse<AuditEntry>> {
    return this.#request(`/platform/audit-logs${query ? `?${query}` : ""}`) as Promise<
      PageResponse<AuditEntry>
    >;
  }

  getOrganizationOverview(id: string): Promise<{
    organization: OrganizationSummary;
    counts: { members: number; teams: number; pendingInvitations: number; integrations: number };
  }> {
    return this.#request(`/organizations/${encodeURIComponent(id)}/overview`) as Promise<{
      organization: OrganizationSummary;
      counts: { members: number; teams: number; pendingInvitations: number; integrations: number };
    }>;
  }

  updateOrganizationSettings(
    id: string,
    input: { name?: string; timezone?: string },
  ): Promise<{ organization: OrganizationSummary }> {
    return this.#request(`/organizations/${encodeURIComponent(id)}/settings`, {
      method: "PATCH",
      body: input,
    }) as Promise<{ organization: OrganizationSummary }>;
  }

  listMembers(id: string, query = ""): Promise<PageResponse<MembershipSummary>> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/members${query ? `?${query}` : ""}`,
    ) as Promise<PageResponse<MembershipSummary>>;
  }

  updateMembership(
    id: string,
    membershipId: string,
    input: { role?: MembershipRole; status?: MembershipStatus },
  ): Promise<{ membership: MembershipSummary }> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(membershipId)}`,
      { method: "PATCH", body: input },
    ) as Promise<{ membership: MembershipSummary }>;
  }

  listTeams(id: string, query = ""): Promise<PageResponse<TeamSummary>> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/teams${query ? `?${query}` : ""}`,
    ) as Promise<PageResponse<TeamSummary>>;
  }

  createTeam(
    id: string,
    input: { name: string; description?: string },
  ): Promise<{ team: TeamSummary }> {
    return this.#request(`/organizations/${encodeURIComponent(id)}/teams`, {
      method: "POST",
      body: input,
    }) as Promise<{ team: TeamSummary }>;
  }

  updateTeam(
    id: string,
    teamId: string,
    input: { name?: string; description?: string; isActive?: boolean },
  ): Promise<{ team: TeamSummary }> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}`,
      { method: "PATCH", body: input },
    ) as Promise<{ team: TeamSummary }>;
  }

  getTeam(
    id: string,
    teamId: string,
  ): Promise<{
    team: TeamSummary & { memberships: Array<{ id: string; membership: MembershipSummary }> };
  }> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}`,
    ) as Promise<{
      team: TeamSummary & { memberships: Array<{ id: string; membership: MembershipSummary }> };
    }>;
  }

  addTeamMember(id: string, teamId: string, membershipId: string): Promise<unknown> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}/members`,
      { method: "POST", body: { membershipId } },
    );
  }

  removeTeamMember(id: string, teamId: string, membershipId: string): Promise<void> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}`,
      { method: "DELETE" },
    ) as Promise<void>;
  }

  listInvitations(id: string, query = ""): Promise<PageResponse<InvitationSummary>> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/invitations${query ? `?${query}` : ""}`,
    ) as Promise<PageResponse<InvitationSummary>>;
  }

  createInvitation(
    id: string,
    input: { email: string; role: MembershipRole; expiresInDays?: number },
  ): Promise<{ invitation: InvitationSummary; localAcceptancePath?: string }> {
    return this.#request(`/organizations/${encodeURIComponent(id)}/invitations`, {
      method: "POST",
      body: input,
    }) as Promise<{ invitation: InvitationSummary; localAcceptancePath?: string }>;
  }

  revokeInvitation(id: string, invitationId: string): Promise<{ invitation: InvitationSummary }> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      { method: "POST" },
    ) as Promise<{ invitation: InvitationSummary }>;
  }

  acceptInvitation(token: string): Promise<unknown> {
    return this.#request("/invitations/accept", { method: "POST", body: { token } });
  }

  registerInvitation(input: {
    token: string;
    email: string;
    displayName: string;
    password: string;
  }): Promise<unknown> {
    return this.#request("/invitations/register", { method: "POST", body: input, auth: false });
  }

  listOrganizationAudit(id: string, query = ""): Promise<PageResponse<AuditEntry>> {
    return this.#request(
      `/organizations/${encodeURIComponent(id)}/audit-logs${query ? `?${query}` : ""}`,
    ) as Promise<PageResponse<AuditEntry>>;
  }

  getIntegrations(
    id: string,
  ): Promise<{ providers: string[]; accounts: IntegrationAccountSummary[] }> {
    return this.#request(`/organizations/${encodeURIComponent(id)}/integrations`) as Promise<{
      providers: string[];
      accounts: IntegrationAccountSummary[];
    }>;
  }

  async #validatedRequest<T>(
    path: string,
    schema: { parse(value: unknown): T },
    options: RequestOptions = {},
  ): Promise<T> {
    return schema.parse(await this.#request(path, options));
  }

  async #request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const headers = new Headers({ Accept: "application/json" });
    const method = options.method ?? "GET";
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = cookieValue("saas_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }
    const requestInit: RequestInit = {
      method,
      headers,
      credentials: "include",
    };
    if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);
    const response = await this.#fetch(`${this.#baseUrl}${path}`, requestInit);
    if (response.status === 401 && options.auth !== false && options.retryAuth !== false) {
      const refreshed = await this.#refresh();
      if (refreshed) return this.#request(path, { ...options, retryAuth: false });
    }
    if (!response.ok) throw await this.#error(response);
    if (response.status === 204) return undefined;
    return response.json() as Promise<unknown>;
  }

  #refresh(): Promise<boolean> {
    if (!this.#refreshPromise) {
      this.#refreshPromise = this.#request("/auth/refresh", {
        method: "POST",
        auth: false,
        retryAuth: false,
      })
        .then(() => true)
        .catch(() => false)
        .finally(() => {
          this.#refreshPromise = undefined;
        });
    }
    return this.#refreshPromise;
  }

  async #error(response: Response): Promise<ApiError> {
    let message =
      response.status === 401
        ? "Your session has ended. Please sign in again."
        : response.status === 403
          ? "You do not have permission to perform this action."
          : `API request failed with status ${response.status}`;
    let code: string | undefined;
    try {
      const body = (await response.json()) as { message?: unknown; code?: unknown };
      if (typeof body.message === "string") message = body.message;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // Keep the status-derived safe message when an error response is not JSON.
    }
    return new ApiError(response.status, message, code);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  retryAuth?: boolean;
}
