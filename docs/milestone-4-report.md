# Milestone 4 report

Date: 2026-10-13  
Status: Complete locally; remote GitHub Actions execution remains unverified until pushed by the owner.

## Scope and outcome

Milestone 4 adds API authentication, rotating server-side sessions, fixed-role permission policies,
active organization membership resolution, tenant-scoped protected reads, platform-role separation,
CSRF/Origin/CORS/header controls, Redis login throttling, controlled account provisioning, audit
events, Swagger descriptions, and positive/negative security integration tests. It does not add a
web login UI, team management, inbox business mutations, analytics, Meta integrations, mobile UI,
or deployment.

## Authentication mechanism

Passwords are Argon2id hashes. Login creates a PostgreSQL `AuthSession`, a short-lived HS256 access
JWT, and a random rotating refresh token whose SHA-256 hash is stored in an immutable token record.
Browser credentials are Secure-by-default HttpOnly SameSite cookies. Mutations using cookies require
the double-submit CSRF token and an allowed Origin. Refresh replay revokes the family; logout revokes
the current session. Access validation checks algorithm, signature, issuer, audience, expiry,
subject, session/access version, and active user state.

See `docs/authentication-authorization.md` for the routes, permission matrix, organization selection,
environment variables, setup, limitations, and production requirements.

## Database migration

`20261013120000_add_auth_sessions` additively creates `auth_sessions` and `auth_refresh_tokens`,
their indexes, unique constraints, and restrictive foreign keys. It contains no drop, truncate,
reset, or data rewrite. RLS remains disabled under ADR-006/OPEN-014.

## Security test coverage

The API integration suite uses two organizations, a Moderator, and an explicit Super Admin. It
covers successful/invalid/missing authentication; expired server sessions; logout; refresh rotation
and replay revocation; disabled users and memberships; Moderator platform denial; explicit Super
Admin platform access without implicit tenant access; missing membership; organization and resource
ID substitution; unknown client role properties; unauthenticated protected routes; distributed
rate limiting; and CSRF enforcement.

## Known limitations and Milestone 5 prerequisites

- Email verification, password reset, invitation acceptance, MFA, and logout-all-devices remain
  future work.
- The CLI password argument can enter shell history; production provisioning needs a protected
  operator input/workflow.
- HS256 uses one active key. Add a key-ID overlap/rotation strategy before live rotation is needed.
- Login limiting is account-key based; production should incorporate trusted-proxy-aware network and
  device risk signals without enabling permanent account denial of service.
- Expired session/token cleanup and security monitoring jobs are not implemented.
- Expo bearer/OS-SecureStore transport remains Milestone 14; no mobile auth UI was added.
- No implicit Super Admin tenant support access exists. Any later break-glass design requires owner
  approval, step-up authentication, bounded access, reason capture, and auditing.
- Milestone 5 may consume these APIs but must not weaken server authorization or put tokens in
  localStorage.

## Final verification

The additive migration was applied to `saas_dev`; migration status reports all three migrations up
to date. The guarded test runner applied the same migration to `saas_test` and passed 8 database
tests. Prisma validation/generation passed. Repository-wide lint and typecheck passed. Unit suites
passed (API 3, worker 2, validation 2, API client 1; no-test packages exited successfully). API
integration passed 10 tests across 2 files. All API, worker, shared-package, Next.js, and Expo Android
production builds passed. Formatting and `git diff --check` passed.

Commands actually executed:

```text
pnpm db:validate
pnpm db:generate
pnpm db:migrate:status
pnpm db:migrate
pnpm test:database
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
git diff --check
```

The standalone `pnpm db:connect` helper encountered the known managed-Windows
`uv_os_get_passwd ENOMEM` condition. This was not treated as a pass; Prisma migration status,
migration deploy, both PostgreSQL-backed suites, and readiness integration connected successfully.
No reset, destructive migration, Docker volume removal, deployment, commit, or push occurred.

## Files created and modified

Created: the `src/auth` module and DTO; `test/auth.integration.test.ts`;
`scripts/provision-user.ts`; migration `20261013120000_add_auth_sessions`;
`docs/authentication-authorization.md`; and this report.

Modified: API Prisma schema, package manifest/lockfile, application/bootstrap/config/health files,
database and health tests, root/API environment examples, and CI environment/test coverage.
Generated Prisma client and build output were regenerated locally but are ignored or treated as
generated artifacts under the existing repository policy.

## Acceptance conclusion

All locally applicable Milestone 4 acceptance criteria pass. Authentication works through the
actual API; session rotation/logout/replay behavior is enforced; roles, platform authority, active
memberships, and tenant-scoped resource ownership are server-validated; cross-tenant and privilege
manipulation tests pass; migrations are safe/current; CI runs the expanded integration suite; and
documentation is complete. Remote GitHub Actions remains unverified because no commit or push was
authorized. No Milestone 5 feature was implemented.
