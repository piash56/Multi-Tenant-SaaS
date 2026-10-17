# Milestone 5 completion report

Date: 2026-10-18  
Status: Implemented and automatically verified; authenticated browser walkthrough remains pending.

## Architecture overview

Milestone 5 is implemented as a modular NestJS administration feature, typed shared client
contracts, and role-aware Next.js App Router pages. Platform administration and organization
administration have separate route families and authorization decorators. All tenant resources are
resolved through the authenticated active organization membership; a global Super Admin receives
no implicit tenant membership or tenant data access.

Sensitive multi-step mutations use Prisma transactions and append audit entries in the same
transaction. PostgreSQL remains authoritative. No analytics, inbox, billing, provider OAuth,
webhook, or message synchronization work from later milestones is included.

## Implemented modules

- Platform overview with real organization, user, membership, and invitation counts.
- Platform organization search, filtering, pagination, details, creation, profile update, and
  activation/suspension.
- Platform user search, filtering, pagination, safe membership summaries, enable/disable, session
  revocation, and self/last-admin safeguards.
- Organization overview and Organization Admin settings.
- Tenant-scoped member search, filtering, role/status changes, and last-admin protection.
- Tenant-scoped team creation, search, details, profile/status update, and member assignment/removal.
- Expiring invitation creation, listing, revocation, authenticated acceptance, invitation-only new
  account onboarding, token hashing, replay/race protection, and audit history.
- Platform and tenant audit-log views with pagination and supported action/actor/date filters.
- Integration foundation for Facebook Pages, Instagram professional accounts, and WhatsApp
  Business using only existing safe connected-account metadata.
- Responsive administration navigation, data tables, forms, status labels, confirmation prompts,
  loading/empty/error/success states, keyboard controls, and visible focus behavior.

## Database migrations

### `20261018120000_add_organization_teams`

Adds `teams` and `team_memberships`. It uses tenant-aware composite foreign keys, unique normalized
team names within an organization, unique team/member assignments, restrictive deletes, and lookup
indexes. It contains no drop, truncate, reset, or existing-row rewrite.

### `20261018121000_reconcile_team_schema`

The guarded `saas_test` database contained an older applied team migration that was not present in
the repository. The old migration was not restored or copied. This forward-only migration adds the
missing normalized-name and direct tenant constraints idempotently so normal development, CI, and
the drifted local test database converge without deleting data. The failed duplicate-create entry
in `saas_test` was resolved and baselined only after its existing tables and constraints were
inspected.

Both migrations were applied to `saas_dev`; the guarded database runner applied/reconciled
`saas_test`. Prisma reports six repository migrations and the development schema is current.

## API endpoint inventory

### Platform-only (`SUPER_ADMIN`)

- `GET /platform/overview`
- `GET|POST /platform/organizations`
- `GET|PATCH /platform/organizations/:organizationId`
- `PATCH /platform/organizations/:organizationId/status`
- `GET /platform/users`
- `GET /platform/users/:userId`
- `PATCH /platform/users/:userId/status`
- `GET /platform/audit-logs`

### Organization-scoped

- `GET /organizations/:organizationId/overview`
- `PATCH /organizations/:organizationId/settings`
- `GET /organizations/:organizationId/members`
- `PATCH /organizations/:organizationId/members/:membershipId`
- `GET|POST /organizations/:organizationId/teams`
- `GET|PATCH /organizations/:organizationId/teams/:teamId`
- `POST /organizations/:organizationId/teams/:teamId/members`
- `DELETE /organizations/:organizationId/teams/:teamId/members/:membershipId`
- `GET|POST /organizations/:organizationId/invitations`
- `POST /organizations/:organizationId/invitations/:invitationId/revoke`
- `GET /organizations/:organizationId/audit-logs`
- `GET /organizations/:organizationId/integrations`

### Invitation acceptance

- `POST /invitations/accept` — authenticated existing user.
- `POST /invitations/register` — public invitation-only account creation.

All mutations retain Origin and cookie CSRF enforcement. Swagger exposes the controllers and DTO
models when local Swagger is enabled.

## Role permission matrix

| Area                                           | Super Admin                   | Organization Admin | Supervisor            | Moderator             |
| ---------------------------------------------- | ----------------------------- | ------------------ | --------------------- | --------------------- |
| Platform overview/organizations/users/audit    | Yes                           | No                 | No                    | No                    |
| Tenant overview and connected-account metadata | Only with explicit membership | Yes                | Read                  | Read                  |
| Organization settings                          | No implicit access            | Edit               | Read through overview | Read through overview |
| Members                                        | No implicit access            | Read/manage        | Read                  | No member list        |
| Teams                                          | No implicit access            | Read/manage        | Read                  | Read                  |
| Invitations                                    | No implicit access            | Manage             | No                    | No                    |
| Tenant audit logs                              | No implicit access            | Read               | No                    | No                    |

The schema enum is `ORGANIZATION_ADMIN` (the approved existing enum), not a new `ORG_ADMIN` alias.
Platform-role promotion is deliberately not exposed through the UI or public API.

## Local development setup

1. Start Docker Desktop.
2. Run `pnpm.cmd infra:up` and wait for PostgreSQL and Redis to become healthy.
3. Run `pnpm.cmd db:migrate` and `pnpm.cmd db:generate`.
4. Start the API and web app with `pnpm.cmd dev` or their individual scripts.
5. Open `http://localhost:3000/login`.

Existing accounts, without passwords:

- `user@admin.com` — global `SUPER_ADMIN`, no tenant membership.
- `user@moderator.com` — `MODERATOR` in Demo Acme.

No credential file was read or printed during this milestone. Required environment variables remain
those documented in `docs/authentication-authorization.md` and `docs/local-development.md`. Browser
development uses `NEXT_PUBLIC_API_URL=/api` and the same-origin Next.js rewrite.

## Invitations and email limitation

Production transactional email is not configured because the provider decision remains open. In
`NODE_ENV=development`, an authorized Organization Admin receives the newly generated acceptance
path once in the create response. The raw token is not stored in PostgreSQL, tracked files, audit
metadata, or normal application logs. Production creation does not claim delivery and does not
return the token. A production email provider and secret-managed delivery adapter are required
before production use.

## Automated verification

Final command results:

| Command                                                  | Result                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm.cmd db:validate`                                   | Passed                                                                                |
| `pnpm.cmd --filter @saas/api exec prisma migrate status` | Passed; six repository migrations, development database current                       |
| `pnpm.cmd lint`                                          | Passed across all workspaces                                                          |
| `pnpm.cmd typecheck`                                     | Passed across all workspaces                                                          |
| `pnpm.cmd test`                                          | Passed: API 3, worker 2, validation 2, API client 9, web 3                            |
| `pnpm.cmd test:e2e`                                      | Passed: 17 tests across health, Milestone 4 auth, and Milestone 5 administration      |
| `pnpm.cmd test:database`                                 | Passed: guarded `saas_test`, 9 tests                                                  |
| `pnpm.cmd build`                                         | Passed: shared packages, API, worker, Next.js (20 static routes), Expo Android export |
| `pnpm.cmd format:check`                                  | Passed repository-wide                                                                |
| `git diff --check`                                       | Passed; line-ending conversion notices only                                           |

Dedicated coverage includes:

- Super Admin access and tenant-role denial.
- Organization creation and suspension plus audit actor/target.
- Safe user responses, disable/session revocation, and self-disable protection.
- Organization Admin permissions, Moderator denial, cross-tenant rejection, membership changes,
  and last-Organization-Admin protection.
- Team creation, duplicate-name/assignment rejection, tenant-safe assignment, and removal.
- Valid, expired, revoked, wrong-email, replayed, and concurrent invitation acceptance.
- Tenant audit isolation and connected-account secret exclusion.
- Database-level team uniqueness and cross-tenant foreign-key enforcement.
- Role-aware web navigation and typed PATCH/DELETE API-client behavior.

## Browser verification

No browser automation dependency is installed and no interactive browser tool was available in the
implementation run. Therefore the authenticated click-through, responsive visual review, and
keyboard-only review are **pending** and are not claimed as passed.

Manual steps:

1. Sign in as `user@admin.com`; open Platform, Organizations, Users, and Platform audit.
2. Create a temporary organization, edit its name/timezone, suspend it, confirm tenant access is
   denied, and reactivate it.
3. Search users and inspect membership summaries. Do not disable the account currently in use.
4. Provision a local Organization Admin and Supervisor with the existing local-only provisioning
   CLI if those accounts do not exist. Never place passwords on the command line; use an ignored
   password file or generated credential file.
5. Sign in as the Organization Admin; update settings, change a non-admin membership role, create
   and edit a team, assign/remove a member, create/revoke an invitation, and inspect tenant audit.
6. Create a second invitation, copy the one-time local development path from the success message,
   open it privately, and complete new-user onboarding with the invited email.
7. Sign in as Supervisor and verify members/teams are read-only.
8. Sign in as `user@moderator.com`; verify settings, invitation, and audit navigation is absent and
   direct restricted operations fail.
9. Attempt an organization-ID substitution and confirm the API returns not found.
10. Verify the integrations page labels all unconfigured providers as not connected and offers no
    nonfunctional Connect action.
11. Repeat at mobile width and with keyboard only; verify focus, navigation, dialogs, forms, tables,
    and logout/session invalidation.

## Security considerations

- Password hashes, refresh hashes, raw invitation tokens, encrypted provider tokens, and message
  content are excluded from administration responses and audit metadata.
- Organization identifiers are always paired with authenticated membership resolution.
- Team relations enforce tenant consistency in PostgreSQL as well as application code.
- Disabling a user revokes active sessions and refresh credentials transactionally.
- An active user cannot disable itself; the last active platform or organization administrator is
  protected from removal/demotion.
- Organization suspension is enforced by the tenant guard and `/auth/me` membership filtering.
- Invitation token hashes are SHA-256 values over high-entropy random tokens; acceptance uses a
  serializable transaction and single conditional status transition.

## Known limitations and production caveats

- Browser workflows remain pending as described above.
- Production email delivery is not configured.
- No live Meta OAuth, webhook, or synchronization behavior exists; provider cards are an accurate
  administration foundation only.
- Platform role promotion/demotion and unrestricted public registration are intentionally absent.
- Distributed rate limiting beyond the existing authentication foundation should be expanded and
  tuned during security hardening before public production traffic.
- Remote CI is unverified until the owner commits/pushes the changes.

## Files created and modified

Primary Milestone 5.2 additions:

- `apps/api/src/admin/*` — DTOs, service, platform/tenant controllers, module, and mutation limiter.
- `apps/api/prisma/migrations/20261018120000_add_organization_teams/*`.
- `apps/api/prisma/migrations/20261018121000_reconcile_team_schema/*`.
- `apps/api/test/admin.integration.test.ts` and expanded database coverage.
- `apps/web/components/admin-ui.tsx` and `invitation-acceptance.tsx`.
- `apps/web/app/dashboard/platform/*`, `apps/web/app/dashboard/organization/*`, and
  `apps/web/app/invitations/accept/*`.
- Shared types and typed API-client administration methods/tests.
- This completion report plus authentication/local-development formatting/documentation updates.

Phase 5.1 files remain in the same uncommitted working tree, including its display-name migration,
authentication client, dashboard shell, login/account pages, and same-origin browser proxy. No
stash was restored, no secret was added, and no commit or push was performed.

## Milestone 6 prerequisites

Before starting Milestone 6, the owner should complete the browser checklist and approve the
completion-credit policy in `OPEN-001` plus the authored-reply threshold in `OPEN-006`. Milestone 6
must reuse these tenant, role, audit, and team boundaries and must not reinterpret replies as
assignment changes.
