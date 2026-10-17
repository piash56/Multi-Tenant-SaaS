"use client";

import { ApiError } from "@saas/api-client";
import type {
  AuditEntry,
  IntegrationAccountSummary,
  InvitationSummary,
  MembershipRole,
  MembershipStatus,
  MembershipSummary,
  OrganizationStatus,
  OrganizationSummary,
  PageResponse,
  PlatformOverviewResponse,
  TeamSummary,
  UserStatus,
  UserSummary,
} from "@saas/shared-types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "../lib/api";
import { useAuth } from "./auth-provider";

function message(error: unknown) {
  return error instanceof ApiError ? error.message : "The request could not be completed.";
}

function dates(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function Status({ value }: { value: string }) {
  return <span className={`adminStatus adminStatus${value}`}>{value.replaceAll("_", " ")}</span>;
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="pageHeading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Loading() {
  return (
    <div className="panel adminLoading" aria-busy="true">
      <div className="spinner" />
      <p>Loading authorized data…</p>
    </div>
  );
}
function Failure({ text, retry }: { text: string; retry(): void }) {
  return (
    <div className="alert alertError" role="alert">
      <strong>Unable to load this page</strong>
      <p>{text}</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="alert alertSuccess" role="status">
      {children}
    </div>
  );
}

function Guard({
  platform = false,
  admin = false,
  children,
}: {
  platform?: boolean;
  admin?: boolean;
  children: ReactNode;
}) {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  const allowed = platform
    ? state.user.platformRole === "SUPER_ADMIN"
    : admin
      ? state.membership?.role === "ORGANIZATION_ADMIN"
      : Boolean(state.membership);
  return allowed ? (
    children
  ) : (
    <div className="stateCard">
      <p className="statusCode">403</p>
      <h1>Access restricted</h1>
      <p>Your current role cannot open this administration page.</p>
      <Link className="button" href="/dashboard">
        Return to dashboard
      </Link>
    </div>
  );
}

function useLoad<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    void loader()
      .then((value) => {
        if (active) {
          setError("");
          setData(value);
        }
      })
      .catch((reason) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
    // The page supplies stable primitive dependencies; loader intentionally follows them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...dependencies]);
  return { data, error, reload, setData };
}

function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage(page: number): void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange(value: string): void;
  placeholder: string;
}) {
  return (
    <label className="searchField">
      <span>Search</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function PlatformOverviewPage() {
  const state = useLoad<PlatformOverviewResponse>(() => api.getPlatformOverview());
  return (
    <Guard platform>
      <div className="contentStack">
        <PageHeader
          eyebrow="Platform administration"
          title="Platform overview"
          description="Database-backed operational totals without tenant message content."
        />
        {state.error ? (
          <Failure text={state.error} retry={state.reload} />
        ) : !state.data ? (
          <Loading />
        ) : (
          <>
            <section className="summaryGrid">
              {Object.entries(state.data.counts).map(([key, value]) => (
                <article className="summaryCard" key={key}>
                  <p>{key.replace(/([A-Z])/g, " $1")}</p>
                  <strong className="metricValue">{value}</strong>
                </article>
              ))}
            </section>
            <AuditTable entries={state.data.recentActivity} title="Recent platform activity" />
          </>
        )}
      </div>
    </Guard>
  );
}

export function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<OrganizationSummary>();
  const query = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  }).toString();
  const state = useLoad<PageResponse<OrganizationSummary>>(
    () => api.listPlatformOrganizations(query),
    [query],
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await api.createPlatformOrganization({
        name: String(form.get("name")),
        slug: String(form.get("slug")),
        timezone: String(form.get("timezone") || "UTC"),
      });
      event.currentTarget.reset();
      setNotice("Organization created.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  async function setOrgStatus(id: string, next: OrganizationStatus) {
    if (
      !confirm(
        `${next === "SUSPENDED" ? "Suspend" : "Activate"} this organization? Member access changes immediately.`,
      )
    )
      return;
    try {
      await api.setPlatformOrganizationStatus(id, next);
      setNotice(`Organization ${next.toLowerCase()}.`);
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard platform>
      <div className="contentStack">
        <PageHeader
          eyebrow="Platform administration"
          title="Organizations"
          description="Create, find, review, and control tenant availability."
        />
        {notice && <Notice>{notice}</Notice>}
        <section className="panel">
          <h2>Create organization</h2>
          <form className="adminForm adminFormInline" onSubmit={create}>
            <label>
              Name
              <input name="name" required minLength={2} maxLength={100} />
            </label>
            <label>
              Slug
              <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
            </label>
            <label>
              Timezone
              <input name="timezone" defaultValue="UTC" required />
            </label>
            <button className="button buttonPrimary">Create</button>
          </form>
        </section>
        <section className="panel">
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Name or slug"
            />
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All</option>
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
              </select>
            </label>
          </div>
          {state.error ? (
            <Failure text={state.error} retry={state.reload} />
          ) : !state.data ? (
            <Loading />
          ) : state.data.items.length === 0 ? (
            <div className="emptyState">
              <strong>No organizations found</strong>
              <p>Adjust the search or create the first organization.</p>
            </div>
          ) : (
            <>
              <div className="tableScroll">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Status</th>
                      <th>Members</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((org) => (
                      <tr key={org.id}>
                        <td>
                          <strong>{org.name}</strong>
                          <small>
                            {org.slug} · {org.timezone}
                          </small>
                        </td>
                        <td>
                          <Status value={org.status} />
                        </td>
                        <td>{org._count?.memberships ?? 0}</td>
                        <td>{dates(org.createdAt)}</td>
                        <td>
                          <button className="textButton" onClick={() => setSelected(org)}>
                            View / edit
                          </button>{" "}
                          <button
                            className="textButton"
                            onClick={() =>
                              void setOrgStatus(
                                org.id,
                                org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                              )
                            }
                          >
                            {org.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={state.data.pagination.page}
                pages={state.data.pagination.pages}
                onPage={setPage}
              />
            </>
          )}
        </section>
        {selected && (
          <PlatformOrganizationEditor
            organization={selected}
            notify={setNotice}
            done={() => {
              state.reload();
              setSelected(undefined);
            }}
          />
        )}
      </div>
    </Guard>
  );
}

function PlatformOrganizationEditor({
  organization,
  notify,
  done,
}: {
  organization: OrganizationSummary;
  notify(value: string): void;
  done(): void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.updatePlatformOrganization(organization.id, {
        name: String(form.get("name")),
        timezone: String(form.get("timezone")),
      });
      notify("Organization details updated.");
      done();
    } catch (error) {
      notify(message(error));
    }
  }
  return (
    <section className="panel">
      <h2>Edit {organization.name}</h2>
      <form className="adminForm" onSubmit={submit}>
        <label>
          Name
          <input name="name" defaultValue={organization.name} required />
        </label>
        <label>
          Slug
          <input value={organization.slug} readOnly />
        </label>
        <label>
          Timezone
          <input name="timezone" defaultValue={organization.timezone} required />
        </label>
        <button className="button buttonPrimary">Save organization</button>
      </form>
      <dl className="detailList">
        <div>
          <dt>Created</dt>
          <dd>{dates(organization.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{dates(organization.updatedAt)}</dd>
        </div>
        <div>
          <dt>Invitations</dt>
          <dd>{organization._count?.invitations ?? 0}</dd>
        </div>
        <div>
          <dt>Connected accounts</dt>
          <dd>{organization._count?.channelAccounts ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}

export function PlatformUsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const query = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  }).toString();
  const state = useLoad<PageResponse<UserSummary>>(() => api.listPlatformUsers(query), [query]);
  async function setStatusValue(user: UserSummary, next: UserStatus) {
    if (
      !confirm(
        `${next === "ACTIVE" ? "Enable" : "Disable"} ${user.email}? Disabling revokes active sessions.`,
      )
    )
      return;
    try {
      await api.setPlatformUserStatus(user.id, next);
      setNotice(`Account ${next.toLowerCase()}.`);
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard platform>
      <div className="contentStack">
        <PageHeader
          eyebrow="Platform administration"
          title="Users"
          description="Safe account and membership summaries. Credentials are never returned."
        />
        {notice && <Notice>{notice}</Notice>}
        <section className="panel">
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Email or display name"
            />
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All</option>
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
                <option>DISABLED</option>
              </select>
            </label>
          </div>
          {state.error ? (
            <Failure text={state.error} retry={state.reload} />
          ) : !state.data ? (
            <Loading />
          ) : (
            <>
              <div className="tableScroll">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Platform role</th>
                      <th>Memberships</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.displayName}</strong>
                          <small>
                            {user.email}
                            <br />
                            Created {dates(user.createdAt)}
                          </small>
                        </td>
                        <td>{user.platformRole.replaceAll("_", " ")}</td>
                        <td>
                          {user.memberships?.length
                            ? user.memberships
                                .map(
                                  (membership) =>
                                    `${membership.organization.name} (${membership.role.replaceAll("_", " ")})`,
                                )
                                .join(", ")
                            : "None"}
                        </td>
                        <td>
                          <Status value={user.status} />
                        </td>
                        <td>
                          <button
                            className="textButton"
                            onClick={() =>
                              void setStatusValue(
                                user,
                                user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                              )
                            }
                          >
                            {user.status === "ACTIVE" ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={state.data.pagination.page}
                pages={state.data.pagination.pages}
                onPage={setPage}
              />
            </>
          )}
        </section>
      </div>
    </Guard>
  );
}

function useOrganization() {
  const { state } = useAuth();
  return state.status === "authenticated" ? state.membership?.organizationId : undefined;
}

export function OrganizationOverviewPage() {
  const id = useOrganization();
  const state = useLoad(
    () =>
      id ? api.getOrganizationOverview(id) : Promise.reject(new Error("Select an organization.")),
    [id],
  );
  return (
    <Guard>
      <div className="contentStack">
        <PageHeader
          eyebrow="Organization administration"
          title="Organization overview"
          description="Current tenant settings and administrative workload."
        />
        {state.error ? (
          <Failure text={state.error} retry={state.reload} />
        ) : !state.data ? (
          <Loading />
        ) : (
          <>
            <section className="summaryGrid">
              {Object.entries(state.data.counts).map(([key, value]) => (
                <article className="summaryCard" key={key}>
                  <p>{key.replace(/([A-Z])/g, " $1")}</p>
                  <strong className="metricValue">{value}</strong>
                </article>
              ))}
            </section>
            <section className="panel">
              <h2>{state.data.organization.name}</h2>
              <dl className="detailList">
                <div>
                  <dt>Slug</dt>
                  <dd>{state.data.organization.slug}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Status value={state.data.organization.status} />
                  </dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{state.data.organization.timezone}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{dates(state.data.organization.createdAt)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </Guard>
  );
}

export function OrganizationSettingsPage() {
  const id = useOrganization();
  const [notice, setNotice] = useState("");
  const state = useLoad(
    () =>
      id ? api.getOrganizationOverview(id) : Promise.reject(new Error("Select an organization.")),
    [id],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.updateOrganizationSettings(id, {
        name: String(form.get("name")),
        timezone: String(form.get("timezone")),
      });
      setNotice("Organization settings saved.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard admin>
      <div className="contentStack">
        <PageHeader
          eyebrow="Organization administration"
          title="Settings"
          description="Organization Admins can edit permitted profile fields. Slug and status are platform-controlled."
        />
        {notice && <Notice>{notice}</Notice>}
        {state.error ? (
          <Failure text={state.error} retry={state.reload} />
        ) : !state.data ? (
          <Loading />
        ) : (
          <section className="panel">
            <form className="adminForm" onSubmit={submit}>
              <label>
                Name
                <input name="name" defaultValue={state.data.organization.name} required />
              </label>
              <label>
                Slug
                <input value={state.data.organization.slug} readOnly aria-describedby="slug-help" />
              </label>
              <small id="slug-help">Read-only platform identifier.</small>
              <label>
                Timezone
                <input name="timezone" defaultValue={state.data.organization.timezone} required />
              </label>
              <button className="button buttonPrimary">Save settings</button>
            </form>
          </section>
        )}
      </div>
    </Guard>
  );
}

export function MembersPage({ ownerView = false }: { ownerView?: boolean }) {
  const id = useOrganization();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const state = useLoad<PageResponse<MembershipSummary>>(
    () =>
      id
        ? api.listMembers(id, search ? `search=${encodeURIComponent(search)}` : "")
        : Promise.reject(new Error("Select an organization.")),
    [id, search],
  );
  async function change(member: MembershipSummary, role: MembershipRole, status: MembershipStatus) {
    if (!id) return;
    if (!confirm(`Change ${member.user.email} to ${role.replaceAll("_", " ")} / ${status}?`))
      return;
    try {
      await api.updateMembership(id, member.id, { role, status });
      setNotice("Membership updated.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard>
      <div className="contentStack">
        <PageHeader
          eyebrow={ownerView ? "Business administration" : "Organization administration"}
          title={ownerView ? "Moderators" : "Members"}
          description={
            ownerView
              ? "Manage the people who supervise or moderate this business workspace."
              : "Tenant-scoped identities, roles, and access status."
          }
          action={
            ownerView ? (
              <Link className="button buttonPrimary" href="/dashboard/organization/invitations">
                Invite moderator
              </Link>
            ) : undefined
          }
        />
        {notice && <Notice>{notice}</Notice>}
        <section className="panel">
          <SearchBar value={search} onChange={setSearch} placeholder="Name or email" />
          {state.error ? (
            <Failure text={state.error} retry={state.reload} />
          ) : !state.data ? (
            <Loading />
          ) : (
            <div className="tableScroll">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Teams</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((member) => (
                    <MemberRow key={member.id} member={member} onChange={change} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Guard>
  );
}

function MemberRow({
  member,
  onChange,
}: {
  member: MembershipSummary;
  onChange(member: MembershipSummary, role: MembershipRole, status: MembershipStatus): void;
}) {
  const { state } = useAuth();
  const canManage =
    state.status === "authenticated" && state.membership?.role === "ORGANIZATION_ADMIN";
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  return (
    <tr>
      <td>
        <strong>{member.displayName}</strong>
        <small>{member.user.email}</small>
      </td>
      <td>
        {canManage ? (
          <select value={role} onChange={(event) => setRole(event.target.value as MembershipRole)}>
            <option value="ORGANIZATION_ADMIN">Organization Admin</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="MODERATOR">Moderator</option>
          </select>
        ) : (
          member.role.replaceAll("_", " ")
        )}
      </td>
      <td>
        {canManage ? (
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as MembershipStatus)}
          >
            <option>ACTIVE</option>
            <option>SUSPENDED</option>
            <option>REMOVED</option>
          </select>
        ) : (
          <Status value={member.status} />
        )}
      </td>
      <td>{member._count?.teamMemberships ?? 0}</td>
      <td>
        {canManage ? (
          <button className="textButton" onClick={() => onChange(member, role, status)}>
            Save
          </button>
        ) : (
          "Read only"
        )}
      </td>
    </tr>
  );
}

export function TeamsPage() {
  const id = useOrganization();
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamSummary>();
  const { state: authState } = useAuth();
  const canManage =
    authState.status === "authenticated" && authState.membership?.role === "ORGANIZATION_ADMIN";
  const state = useLoad<PageResponse<TeamSummary>>(
    () =>
      id
        ? api.listTeams(id, search ? `search=${encodeURIComponent(search)}` : "")
        : Promise.reject(new Error("Select an organization.")),
    [id, search],
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.createTeam(id, {
        name: String(form.get("name")),
        description: String(form.get("description") || ""),
      });
      event.currentTarget.reset();
      setNotice("Team created.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  async function toggle(team: TeamSummary) {
    if (!id || !confirm(`${team.isActive ? "Deactivate" : "Activate"} ${team.name}?`)) return;
    try {
      await api.updateTeam(id, team.id, { isActive: !team.isActive });
      setNotice("Team updated.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard>
      <div className="contentStack">
        <PageHeader
          eyebrow="Organization administration"
          title="Teams"
          description="Group active members without crossing tenant boundaries."
        />
        {notice && <Notice>{notice}</Notice>}
        {canManage && (
          <section className="panel">
            <h2>Create team</h2>
            <form className="adminForm adminFormInline" onSubmit={create}>
              <label>
                Name
                <input name="name" required minLength={2} />
              </label>
              <label>
                Description
                <input name="description" maxLength={500} />
              </label>
              <button className="button buttonPrimary">Create</button>
            </form>
          </section>
        )}
        <section className="panel">
          <SearchBar value={search} onChange={setSearch} placeholder="Team name or description" />
          {state.error ? (
            <Failure text={state.error} retry={state.reload} />
          ) : !state.data ? (
            <Loading />
          ) : (
            <div className="tableScroll">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Status</th>
                    <th>Members</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((team) => (
                    <tr key={team.id}>
                      <td>
                        <strong>{team.name}</strong>
                        <small>{team.description || "No description"}</small>
                      </td>
                      <td>
                        <Status value={team.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>{team._count?.memberships ?? 0}</td>
                      <td>{dates(team.updatedAt)}</td>
                      <td>
                        <button className="textButton" onClick={() => setSelectedTeam(team)}>
                          {canManage ? "Manage" : "View"} members
                        </button>
                        {canManage && (
                          <>
                            {" "}
                            <button className="textButton" onClick={() => void toggle(team)}>
                              {team.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {id && selectedTeam && (
          <TeamAssignments
            organizationId={id}
            team={selectedTeam}
            notify={setNotice}
            canManage={canManage}
          />
        )}
      </div>
    </Guard>
  );
}

function TeamAssignments({
  organizationId,
  team,
  notify,
  canManage,
}: {
  organizationId: string;
  team: TeamSummary;
  notify(value: string): void;
  canManage: boolean;
}) {
  const members = useLoad<PageResponse<MembershipSummary>>(
    () => api.listMembers(organizationId, "status=ACTIVE&limit=100"),
    [organizationId],
  );
  const detail = useLoad(() => api.getTeam(organizationId, team.id), [organizationId, team.id]);
  const [membershipId, setMembershipId] = useState("");
  async function add() {
    if (!membershipId) return;
    try {
      await api.addTeamMember(organizationId, team.id, membershipId);
      notify("Member assigned to team.");
      detail.reload();
    } catch (error) {
      notify(message(error));
    }
  }
  async function remove(id: string) {
    if (!confirm("Remove this member from the team?")) return;
    try {
      await api.removeTeamMember(organizationId, team.id, id);
      notify("Member removed from team.");
      detail.reload();
    } catch (error) {
      notify(message(error));
    }
  }
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.updateTeam(organizationId, team.id, {
        name: String(form.get("name")),
        description: String(form.get("description") || ""),
      });
      notify("Team details updated.");
      detail.reload();
    } catch (error) {
      notify(message(error));
    }
  }
  return (
    <section className="panel">
      <h2>
        {canManage ? "Manage" : "View"} {team.name}
      </h2>
      {canManage && (
        <>
          <form className="adminForm adminFormInline" onSubmit={edit}>
            <label>
              Name
              <input name="name" defaultValue={team.name} required />
            </label>
            <label>
              Description
              <input name="description" defaultValue={team.description ?? ""} />
            </label>
            <button className="button">Save details</button>
          </form>
          {members.data && (
            <div className="toolbar">
              <label>
                Active member
                <select
                  value={membershipId}
                  onChange={(event) => setMembershipId(event.target.value)}
                >
                  <option value="">Choose a member</option>
                  {members.data.items.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName} — {member.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button buttonPrimary"
                disabled={!membershipId}
                onClick={() => void add()}
              >
                Assign member
              </button>
            </div>
          )}
        </>
      )}
      {detail.error ? (
        <Failure text={detail.error} retry={detail.reload} />
      ) : !detail.data ? (
        <Loading />
      ) : detail.data.team.memberships.length === 0 ? (
        <div className="emptyState">
          <strong>No team members</strong>
        </div>
      ) : (
        <ul className="membershipList">
          {detail.data.team.memberships.map((assignment) => (
            <li key={assignment.id}>
              <div>
                <strong>{assignment.membership.displayName}</strong>
                <span>
                  {assignment.membership.user.email} ·{" "}
                  {assignment.membership.role.replaceAll("_", " ")}
                </span>
              </div>
              {canManage && (
                <button
                  className="textButton textDanger"
                  onClick={() => void remove(assignment.membership.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InvitationsPage() {
  const id = useOrganization();
  const [notice, setNotice] = useState("");
  const state = useLoad<PageResponse<InvitationSummary>>(
    () => (id ? api.listInvitations(id) : Promise.reject(new Error("Select an organization."))),
    [id],
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.createInvitation(id, {
        email: String(form.get("email")),
        role: String(form.get("role")) as MembershipRole,
      });
      event.currentTarget.reset();
      setNotice(
        result.localAcceptancePath
          ? `Invitation created. Local development link: ${location.origin}${result.localAcceptancePath}`
          : "Invitation created. Production email delivery is not configured.",
      );
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  async function revoke(invitation: InvitationSummary) {
    if (!id || !confirm(`Revoke the invitation for ${invitation.normalizedEmail}?`)) return;
    try {
      await api.revokeInvitation(id, invitation.id);
      setNotice("Invitation revoked.");
      state.reload();
    } catch (error) {
      setNotice(message(error));
    }
  }
  return (
    <Guard admin>
      <div className="contentStack">
        <PageHeader
          eyebrow="Organization administration"
          title="Invitations"
          description="Single-use, expiring, invitation-only onboarding."
        />
        {notice && <Notice>{notice}</Notice>}
        <section className="panel">
          <h2>Create invitation</h2>
          <form className="adminForm adminFormInline" onSubmit={create}>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="role">
                <option value="MODERATOR">Moderator</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ORGANIZATION_ADMIN">Organization Admin</option>
              </select>
            </label>
            <button className="button buttonPrimary">Create invitation</button>
          </form>
          <p className="formHint">
            No production email provider is configured. Development links appear only in this
            authorized response and are not logged.
          </p>
        </section>
        <section className="panel">
          {state.error ? (
            <Failure text={state.error} retry={state.reload} />
          ) : !state.data ? (
            <Loading />
          ) : state.data.items.length === 0 ? (
            <div className="emptyState">
              <strong>No invitations</strong>
            </div>
          ) : (
            <div className="tableScroll">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>{invitation.normalizedEmail}</td>
                      <td>{invitation.role.replaceAll("_", " ")}</td>
                      <td>
                        <Status value={invitation.status} />
                      </td>
                      <td>{dates(invitation.expiresAt)}</td>
                      <td>
                        {invitation.status === "PENDING" ? (
                          <button
                            className="textButton textDanger"
                            onClick={() => void revoke(invitation)}
                          >
                            Revoke
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Guard>
  );
}

function AuditTable({
  entries,
  title = "Audit activity",
}: {
  entries: AuditEntry[];
  title?: string;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {entries.length === 0 ? (
        <div className="emptyState">
          <strong>No audit entries found</strong>
        </div>
      ) : (
        <div className="tableScroll">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{dates(entry.createdAt)}</td>
                  <td>
                    {entry.actorUser?.displayName ?? "System"}
                    <small>{entry.actorUser?.email}</small>
                  </td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    {entry.targetType}
                    <small>{entry.targetId}</small>
                  </td>
                  <td>
                    <Status value={entry.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AuditPage({ platform = false }: { platform?: boolean }) {
  const id = useOrganization();
  const [action, setAction] = useState("");
  const query = action ? `action=${encodeURIComponent(action)}` : "";
  const state = useLoad<PageResponse<AuditEntry>>(
    () =>
      platform
        ? api.listPlatformAudit(query)
        : id
          ? api.listOrganizationAudit(id, query)
          : Promise.reject(new Error("Select an organization.")),
    [platform, id, query],
  );
  return (
    <Guard platform={platform} admin={!platform}>
      <div className="contentStack">
        <PageHeader
          eyebrow={platform ? "Platform administration" : "Organization administration"}
          title="Audit logs"
          description="Read-only security and administration history."
        />
        <section className="panel">
          <SearchBar value={action} onChange={setAction} placeholder="Filter by action" />
        </section>
        {state.error ? (
          <Failure text={state.error} retry={state.reload} />
        ) : !state.data ? (
          <Loading />
        ) : (
          <AuditTable entries={state.data.items} />
        )}
      </div>
    </Guard>
  );
}

const providerLabels: Record<string, string> = {
  FACEBOOK_MESSENGER: "Facebook Pages",
  INSTAGRAM: "Instagram professional accounts",
  WHATSAPP_BUSINESS: "WhatsApp Business",
};
export function IntegrationsPage() {
  const id = useOrganization();
  const state = useLoad<{ providers: string[]; accounts: IntegrationAccountSummary[] }>(
    () => (id ? api.getIntegrations(id) : Promise.reject(new Error("Select an organization."))),
    [id],
  );
  return (
    <Guard>
      <div className="contentStack">
        <PageHeader
          eyebrow="Integration foundation"
          title="Connected accounts"
          description="Accurate tenant metadata only. Live connection and synchronization arrive in later milestones."
        />
        {state.error ? (
          <Failure text={state.error} retry={state.reload} />
        ) : !state.data ? (
          <Loading />
        ) : (
          <section className="integrationGrid">
            {state.data.providers.map((provider) => {
              const accounts = state.data!.accounts.filter((item) => item.platform === provider);
              return (
                <article className="panel" key={provider}>
                  <h2>{providerLabels[provider]}</h2>
                  <p>
                    OAuth, webhooks, and message synchronization are not implemented in Milestone 5.
                  </p>
                  {accounts.length ? (
                    <ul className="integrationAccounts">
                      {accounts.map((account) => (
                        <li key={account.id}>
                          <strong>{account.displayName}</strong>
                          <Status value={account.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="emptyState">
                      <strong>Not connected</strong>
                      <p>No authorized account metadata exists.</p>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </Guard>
  );
}
