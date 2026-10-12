# Database migrations

## Safety rules

PostgreSQL is authoritative and Prisma migrations are the only schema deployment mechanism. Never
use `prisma db push`, reset a database, or remove the Compose volume as a migration shortcut.
Before applying a migration, verify `DATABASE_URL`, inspect the target database and migration
history, review the generated SQL, and stop if a destructive statement could affect existing data.

The local project database is `saas_dev` on `127.0.0.1:5433`. The unrelated stopped container named
`postgres` must not be used or modified. Production migrations require a separate least-privilege
migration identity, backup/recovery readiness, and an approved rollout plan.

## Commands

From the repository root (use `pnpm.cmd` in PowerShell):

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate:status
pnpm db:migrate
```

`pnpm db:migrate` runs `prisma migrate deploy`; it applies already-reviewed versioned migrations
and never creates an unreviewed migration interactively. For a future development migration, first
run `prisma migrate dev --create-only --name <descriptive_name>` from `apps/api`, review the SQL,
then use the deploy command above.

## Database tests

Database tests are deliberately guarded. They require a database name ending in `_test`, apply
committed migrations, and wrap every test in a transaction that is rolled back. Create the local
test database once after starting the Compose services:

```powershell
docker compose exec postgres createdb -U saas_app saas_test
pnpm.cmd test:database
```

If `createdb` reports that the database already exists, it is ready to use. The test runner uses
`DATABASE_TEST_URL` when configured. Otherwise, it safely changes the known local `saas_dev` URL
to `saas_test` for its child processes only. It never rewrites a remote or unfamiliar database URL,
and CI continues to use the explicit `_test` URL supplied by the workflow.

CI supplies a disposable `saas_test` PostgreSQL service and runs the same command. Never point this
command at a customer, staging, production, or shared development database.

## Development seed

```bash
pnpm db:seed
```

The seed is idempotent and synthetic. It refuses to run in production or against any database other
than exactly `saas_dev`. It creates a demo organization, user, membership, pending mock channel,
contact, and conversation; it contains no provider token or real customer information.

## Tenant isolation and RLS

Tenant-owned rows carry `organization_id`. Child relationships use composite foreign keys to a
parent's `(organization_id, id)` whenever practical, including contacts, channel accounts,
conversations, messages, assignees, comment parents/replies, notifications, and historical
assignment/resolution facts. Globally scoped rows are limited to users and explicitly platform-level
events. Webhooks may initially be unresolved and quarantined, so their tenant/account is nullable;
processing must resolve and verify it before tenant mutation.

RLS is not enabled. The approved architecture makes application/repository scoping plus composite
constraints the primary boundary. RLS remains defense-in-depth for Milestone 4 only after Prisma's
pooled transaction-local tenant context, migration role, worker behavior, and negative tests prove
that context cannot leak or be bypassed.

Application-level authorization is still required for resource references stored as generic
`resource_type/resource_id`, outbox aggregate identifiers, audit targets, and provider-neutral
billing metadata because polymorphic database foreign keys are not available. These identifiers
must never be fetched without the server-derived tenant context.
