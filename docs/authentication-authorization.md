# Authentication, authorization, and tenant isolation

## Architecture

The NestJS API owns credentials, sessions, and authorization. There is no public self-registration.
Accounts are created through the controlled `auth:provision` command, and Super Admin creation
requires an explicit approval reference that is written to the audit log.

Passwords use Argon2id (`64 MiB`, three iterations, one lane). The database stores only the
Argon2id hash. Authentication failures deliberately return the same `Invalid email or password`
message for an unknown email, wrong password, or disabled user.

Browser sessions use:

- a 15-minute HS256 access JWT in the `saas_access` HttpOnly cookie;
- a random 256-bit refresh credential in the `saas_refresh` HttpOnly cookie;
- a readable random `saas_csrf` cookie paired with `X-CSRF-Token` on mutations;
- `SameSite=Lax`, `Secure` by default, an explicit CORS allowlist, and Origin validation;
- a 30-day server-side session and one-time refresh-token records stored as SHA-256 hashes.

Refresh rotates atomically. Reuse of a consumed credential revokes the whole session family and
increments its access version, so previously issued access JWTs stop working. Logout revokes the
session and refresh records and clears all three cookies. Every authenticated request rechecks the
session and active user in PostgreSQL; permission-sensitive tenant requests also recheck the active
membership and organization.

JWT validation fixes the algorithm to HS256 and validates signature, issuer, audience, expiry,
session ID, subject, and access version. The signing secret is environment-specific and must be at
least 32 characters. Production should use a generated 32-byte-or-larger secret from a managed
secret store and rotate it through an approved overlapping-key design before zero-downtime key
rotation is needed.

This cookie transport suits the Next.js browser because JavaScript cannot read either credential.
The same server-side session model supports Expo later: Milestone 14 will add the documented mobile
transport that returns short access material to memory and rotating refresh material to OS-backed
SecureStore. No token belongs in localStorage, AsyncStorage, a URL, or a client bundle.

## Routes

| Method and route                                                   | Access                                  | Purpose                                              |
| ------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `POST /auth/login`                                                 | Public, rate limited, Origin checked    | Validate credentials and set session cookies         |
| `POST /auth/refresh`                                               | Refresh cookie, CSRF and Origin checked | Rotate refresh credential and renew access           |
| `POST /auth/logout`                                                | Authenticated, CSRF and Origin checked  | Revoke current session and clear cookies             |
| `GET /auth/me`                                                     | Authenticated                           | Return safe user and active organization memberships |
| `GET /organizations/:organizationId/context`                       | Active membership + `organization.read` | Show server-validated tenant context                 |
| `GET /organizations/:organizationId/conversations/:conversationId` | Active membership + `inbox.read`        | Demonstrate tenant-composite resource lookup         |
| `GET /platform/security-context`                                   | Explicit Super Admin only               | Demonstrate isolated platform authorization          |
| `GET /health/live`, `GET /health/ready`                            | Public                                  | Minimal monitoring endpoints                         |

Milestone 5 adds dedicated administration endpoints under `/platform/*` and
`/organizations/:organizationId/*`. Their complete inventory and role matrix are documented in
`docs/milestone-5-completion-report.md`. Platform routes never infer tenant membership; every
organization route continues through the active-membership tenant guard.

Swagger is available at `/docs` only when `SWAGGER_ENABLED=true`. Keep it disabled in production
unless deliberately protected at the network/application edge. The OpenAPI document describes the
cookie and bearer access schemes; it never contains credentials.

## Role-permission policy

Initial roles are fixed, per ADR-015. They map to granular server permissions and can evolve later
without storing client-supplied permissions.

| Area                           | Organization Admin  | Supervisor          | Moderator  | Super Admin                     |
| ------------------------------ | ------------------- | ------------------- | ---------- | ------------------------------- |
| Organization settings          | Read/update         | Read                | Read       | No implicit access              |
| Members                        | Read/manage/invite  | Read                | None       | Platform policy only            |
| Channels                       | Read/manage         | Read                | Read       | No implicit access              |
| Inbox and replies              | Read/reply/moderate | Read/reply/moderate | Read/reply | No implicit access              |
| Assignment                     | Self and manage     | Self and manage     | Self only  | No implicit access              |
| Resolve/reopen                 | Yes                 | Yes                 | Yes        | No implicit access              |
| Analytics                      | Self/team           | Self/team           | Self       | Platform aggregate policy later |
| Tenant audit                   | Read                | None by default     | None       | Explicit platform audit only    |
| Platform user/tenant lifecycle | No                  | No                  | No         | Yes, explicit platform routes   |

Authorization is deny-by-default. A route becomes public only through `@Public()`. Tenant routes
declare `@RequirePermissions(...)`; platform routes declare `@RequirePlatformPermissions(...)`.
Super Admin does not silently acquire a tenant membership or tenant data access.

## Organization context and repository rule

The organization ID is explicit in the route, but is untrusted input. The tenant guard resolves the
authenticated user, loads the `(organization_id,user_id)` membership, requires active user,
session, organization, and membership states, and creates an immutable `TenantContext`. Services
must receive that context. Repositories fetch tenant-owned objects with composite identifiers such
as `{ organizationId, id }`; they must not fetch globally and check afterward.

Cross-tenant and missing membership lookups return a safe `404`. Role violations return `403` and
unauthenticated requests return `401`. PostgreSQL composite foreign keys from Milestone 3 remain a
second boundary. RLS remains disabled because Prisma pooled transaction-local tenant context has
not been proven safe; application scoping plus composite constraints are the approved primary
controls.

Never accept a membership role, permission, organization filter, moderator author ID, or
assignee-at-send identity as authoritative request data. Future authorship must use
`TenantContext.membershipId`.

## API and operational security

- Global DTO validation strips nothing silently: unknown properties are rejected.
- Helmet sets security headers. CORS allows only configured origins and credentials.
- Login limits each normalized account key to five attempts per minute using Redis.
- Authorization denials for platform permissions and refresh reuse create audit records.
- Logger redaction covers authorization, cookie, and set-cookie headers.
- Safe errors hide stacks, SQL, token values, hashes, and cross-tenant existence.
- Secrets fail startup validation. No production secret is committed.

The current rate limit is a Milestone 4 foundation, not a final abuse system. Before production,
add trusted-proxy-aware network/device signals, alerting, bounded retention/cleanup for expired
session records, and a signing-key rotation runbook. Password reset, email verification, invitation
acceptance, MFA, and logout-all-devices are intentionally not implemented yet.

## Environment variables

| Variable             | Purpose                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `AUTH_JWT_SECRET`    | At least 32 characters; unique per environment; managed secret in production |
| `AUTH_JWT_ISSUER`    | Expected JWT issuer, normally `unified-inbox-api`                            |
| `AUTH_JWT_AUDIENCE`  | Expected client audience, normally `unified-inbox-clients`                   |
| `AUTH_COOKIE_SECURE` | `false` only for local HTTP; `true` in production                            |
| `CORS_ORIGINS`       | Comma-separated exact browser origins; never `*` with credentials            |
| `SWAGGER_ENABLED`    | Local documentation switch; production default is `false`                    |

Generate a secret locally with a cryptographically secure password manager or, for example,
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Do not paste
the resulting value into source control, chat, logs, screenshots, or client environment variables.

## Local setup and testing

1. Copy `apps/api/.env.example` to `apps/api/.env` and replace `AUTH_JWT_SECRET`.
   Keep `apps/web/.env.local` set to `NEXT_PUBLIC_API_URL=/api`; the Next.js development proxy
   keeps browser session cookies same-origin while forwarding API requests to port 3001.
2. Start PostgreSQL and Redis with `pnpm.cmd infra:up`.
3. Run `pnpm.cmd db:migrate` and `pnpm.cmd db:migrate:status`.
4. Provision a local organization user with a generated password:

   ```powershell
   pnpm.cmd --filter @saas/api auth:provision --email user@example.test --display-name "Local Moderator" --generate-password --organization-id <uuid> --role MODERATOR --local-development
   ```

5. Start the API with `pnpm.cmd dev:api`, open `/docs`, and call login with credentials included.
6. For logout/refresh, copy the `saas_csrf` cookie value into `X-CSRF-Token`; the browser sends the
   HttpOnly credentials automatically.
7. Run `pnpm.cmd test:e2e` for authentication/security cases and the full regression set in the
   Milestone 4 report.

Super Admin provisioning is intentionally separate and auditable:

```powershell
pnpm.cmd --filter @saas/api auth:provision --email admin@example.test --display-name "Local Super Admin" --generate-password --super-admin --approved-by "owner-change-reference" --local-development
```

`--generate-password` creates a different cryptographically random password for each invocation and
writes it beneath the ignored `.local/credentials/` directory. The command prints only the file
path, never the password or hash. Open the named file locally when ready to sign in, keep it out of
screenshots and chat, and delete it after transferring the password to a local password manager.
`--password-file` is available when an operator supplies a secret through a protected file. Avoid
`--password`, because process arguments and shell history can expose it.

Provisioning refuses to modify an existing email and uses create-only database operations, so a
repeat cannot silently reset a password or elevate a role. The `--local-development` safeguard
rejects production and any database other than `saas_dev`. Super Admin provisioning additionally
requires `--approved-by`; it creates a platform role without an organization membership.

Before production, disable temporary accounts rather than deleting audit history: revoke all rows
in `auth_sessions` for the user (and their associated refresh tokens), set memberships to `REMOVED`
where applicable, and set the user status to `DISABLED`, all in one reviewed transaction. Refresh
tokens are tied to their session, so revoking every active session immediately invalidates refresh
and access-session checks. Permanent deletion should use a separately reviewed retention workflow
that accounts for restrictive foreign keys and preserved audit records; do not delete these users
ad hoc from the database.
