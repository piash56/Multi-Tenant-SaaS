# Milestone 5.1 report

Date: 2026-10-13  
Status: Implemented and locally verified, with the browser-authenticated workflow requiring a
provisioned account for final owner verification.

## Scope and outcome

Phase 5.1 replaces the web foundation screen with a responsive SaaS dashboard, real API login and
logout, current-user loading, rotating-session renewal, organization context selection, role-aware
capability presentation, and accessible account, forbidden, error, loading, empty, and not-found
states. Later Milestone 5 administration flows remain deliberately inactive and are labeled as
future phases.

No Prisma schema or migration changed. No user, organization, membership, or fabricated analytics
data is created by the web application.

## Dashboard architecture

- The App Router root installs one client-side authentication provider. It loads `GET /auth/me`,
  treats the API response as authoritative, and exposes no credential material to components.
- `/dashboard` and `/dashboard/account` render inside a protected shell. While identity is checked,
  protected content is withheld behind a safe loading state; an unauthenticated result redirects to
  `/login` with a dashboard-only return path.
- The shell provides responsive desktop/mobile navigation, an organization selector containing
  only active memberships returned by the API, the current user and role, account details, logout,
  a skip link, visible focus treatment, and reduced-motion support.
- Super Admin is displayed as platform authority only. It receives no fabricated membership and no
  implicit tenant access. Organization actions are derived from the authenticated membership role.
- Navigation contains only implemented destinations. Future organization, team, invitation,
  audit, analytics, inbox, and integration areas are informational text rather than active controls.

## Authentication and API integration

`@saas/api-client` now provides typed login, current-user, logout, and organization-context methods.
Every browser request uses `credentials: "include"`. State-changing requests copy the readable
`saas_csrf` cookie into `X-CSRF-Token`. An authenticated `401` starts one shared refresh request;
successful rotation retries the original request exactly once, while refresh failure returns a
typed error and cannot loop.

The client validates successful auth and organization responses at runtime. It never reads the
HttpOnly access or refresh cookie, stores no token in localStorage/sessionStorage, and emits safe
status-based errors. Session storage holds only the selected organization ID and is cleared on
logout.

Local browser/API ports share the `localhost` cookie host, so the existing cookie and CSRF design is
compatible without backend changes. A production deployment must keep the web app and API in a
same-site cookie architecture (normally one public origin with an API proxy, or a deliberately
reviewed sibling-domain cookie design); `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` must use the exact
approved origins. This phase does not loosen cookie, CORS, Origin, or CSRF enforcement.

## Environment and startup

No new environment variable was added.

1. Configure `apps/api/.env` as documented in `docs/authentication-authorization.md`.
2. Keep `apps/web/.env.local` set to `NEXT_PUBLIC_API_URL=http://localhost:3001` for local use.
3. Start PostgreSQL and Redis with `pnpm.cmd infra:up`.
4. Apply existing migrations with `pnpm.cmd db:migrate` if migration status says they are pending.
5. Start API and web in separate terminals with `pnpm.cmd dev:api` and `pnpm.cmd dev:web`.
6. Use an existing provisioned account. Account provisioning remains the documented Milestone 4
   operator task and is not exposed as registration.

## Automated verification

Executed locally on 2026-10-13:

| Command                                                  | Result                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm.cmd db:validate`                                   | Passed; Prisma schema valid                                               |
| `pnpm.cmd --filter @saas/api exec prisma migrate status` | Passed; 3 migrations, database current                                    |
| `pnpm.cmd lint`                                          | Passed after fixing the reported React effect lint violation              |
| `pnpm.cmd typecheck`                                     | Passed across all workspaces                                              |
| `pnpm.cmd test`                                          | Passed; API 3, worker 2, validation 2, API client 7, web 2 at full run    |
| `pnpm.cmd test:e2e`                                      | Passed; 10 API integration tests                                          |
| `pnpm.cmd test:database`                                 | Passed; guarded `saas_test`, 8 database tests                             |
| `pnpm.cmd build`                                         | Passed for shared packages, API, worker, Next.js, and Expo Android export |
| `pnpm.cmd format:check`                                  | Failed on 8 unchanged files; all Phase 5.1 files pass targeted check      |
| `git diff --check`                                       | Passed (line-ending conversion notices only)                              |

The API integration suite preserves Milestone 4 coverage for login success/failure, `/auth/me`,
unauthenticated requests, logout/CSRF, refresh rotation and replay, expired sessions, role denial,
Super Admin separation, disabled memberships, and cross-tenant identifier substitution. New shared
client tests cover credentialed login, typed failure, current-user renewal, failed-renewal loop
prevention, network errors, and browser CSRF handling. Web policy tests verify only implemented
routes are shown, tenant/platform actions remain separate, and protected return paths are safe. The
final focused web run passed all 3 web tests.

The repository-wide formatting check reports eight unchanged files from Milestone 4:
`apps/api/package.json`, `apps/api/scripts/provision-user.ts`, `apps/api/src/app.module.ts`,
`apps/api/src/auth/auth.module.ts`, `apps/api/src/bootstrap.ts`,
`apps/api/test/database.integration.test.ts`, `docs/authentication-authorization.md`, and
`docs/local-development.md`. They were not rewritten because they are outside this phase. A targeted
Prettier check of every Phase 5.1 file passes.

## Live verification status

The production builds of the API and web app were started locally. HTTP smoke checks confirmed:

- `/login` returned `200` and contained the sign-in heading.
- `/dashboard` returned the static protected shell without leaking the existing organization name.
- API readiness returned `ok`.
- Unauthenticated `GET /auth/me` returned `401`.

No browser automation capability is installed in the repository or available in this run, so the
visual responsive layout and an authenticated browser click-through were not claimed as tested.
The real authenticated API flow is covered by the passing integration suite, but the owner must use
the existing account credentials to complete the manual browser steps below.

## Manual verification for beginners

1. Open `http://localhost:3000/login` and confirm the email/password labels, keyboard focus rings,
   and narrow/mobile layout.
2. Open `http://localhost:3000/dashboard` in a private window. Confirm protected content does not
   appear and the app redirects to login after the session check.
3. Sign in with an existing provisioned user. Confirm the dashboard shows the exact email, display
   name, organization, and role returned by the API.
4. If the account has multiple active memberships, change the organization selector and confirm
   only those returned organizations are offered and the displayed role/context changes.
5. Open **My account** and confirm active memberships and roles. For a Super Admin without a tenant
   membership, confirm no private tenant context is displayed.
6. Use keyboard-only navigation: activate the skip link, sidebar links, organization selector,
   account menu, and sign-out button. At a narrow viewport, open and close the sidebar.
7. Sign out and confirm `/dashboard` again redirects to login. Use browser developer tools to
   confirm no access or refresh token exists in localStorage or sessionStorage.
8. To exercise renewal, retain the refresh session while allowing the access cookie to expire, then
   revisit the dashboard. Confirm `/auth/refresh` succeeds once and `/auth/me` is retried. Revoke the
   session server-side and confirm the next check returns to login.

## Files created and modified

Created:

- `apps/web/app/login/page.tsx`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/loading.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/account/page.tsx`
- `apps/web/app/forbidden/page.tsx`
- `apps/web/components/auth-provider.tsx`
- `apps/web/components/dashboard-shell.tsx`
- `apps/web/components/login-form.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/dashboard.ts`
- `apps/web/lib/dashboard.test.ts`
- `docs/milestone-5-phase-1-report.md`

Modified:

- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/error.tsx`
- `apps/web/app/not-found.tsx`
- `apps/web/app/styles.css`
- `packages/api-client/src/index.ts`
- `packages/api-client/src/index.test.ts`
- `packages/shared-types/src/index.ts`
- `packages/validation/src/index.ts`

## Known limitations and Phase 5.2 prerequisites

- No organization CRUD, team/member management, invitation flow, audit administration, analytics,
  inbox, connected-account workflow, billing, or deployment functionality is implemented.
- Client-side route protection controls presentation and navigation; the NestJS API remains the
  security boundary for every protected resource. Static dashboard HTML contains no tenant data.
- There is no browser automation dependency in this repository. The live HTTP/render smoke status
  is recorded in the final handoff; a complete authenticated browser flow requires credentials for
  an already provisioned account.
- Before Phase 5.2, define its explicit route/API scope, retain backend permission enforcement, and
  add tenant-scoped organization mutations only after reviewing the roadmap and authorization
  contracts. Do not infer tenant authority from this dashboard presentation.

## Phase 5.1 acceptance checklist

- [x] Login page renders (production HTTP smoke returned `200`).
- [ ] Existing provisioned user login verified through an interactive browser (API integration
      login passed; browser credentials were not available to this run).
- [ ] Dashboard visually verified after interactive browser authentication (implementation and API
      tests pass; manual credentialed browser verification remains).
- [x] Correct user identity, membership, and role are sourced from validated `/auth/me` responses.
- [x] Protected content is withheld until authentication resolves; unauthenticated API access is
      rejected and the dashboard shell redirects guests to login.
- [x] Logout and CSRF behavior pass API integration and typed-client tests.
- [x] Session rotation, expiry, replay rejection, and one-retry client behavior pass tests.
- [ ] Responsive/accessibility behavior is implemented but still needs a real-browser visual and
      keyboard smoke test.
- [x] Milestone 4 unit, integration, database, type, lint, and build checks pass.
- [ ] All repository-wide checks pass: `format:check` remains blocked by eight unchanged
      pre-existing formatting failures; all Phase 5.1 files pass targeted formatting validation.
