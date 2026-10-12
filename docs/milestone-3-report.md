# Milestone 3 report

Date: 2026-10-13  
Status: Complete locally; remote GitHub Actions execution remains unverified until pushed by the owner.

## Implemented schema

The initial PostgreSQL business schema includes global users and organizations; fixed organization
memberships and invitations; connected channel accounts; contacts and provider identities; direct
message conversations, messages, attachments, and delivery events; immutable assignment and
resolution facts; social posts, comments, and internal comment replies; webhook receipts;
transactional outbox records; audit logs; notifications; idempotency records; and provider-neutral
subscription/billing foundations.

Initial roles are the accepted fixed set: Organization Admin, Supervisor, and Moderator, with Super
Admin represented as a narrow global user privilege. No Milestone 4 authentication or RBAC API was
implemented. Tokens have encrypted-value/key-version placeholders and remain server-side.

## Isolation, attribution, and reliability guarantees

- Every tenant-owned root has `organization_id`; parent/child links use tenant-composite foreign
  keys wherever practical. Cross-tenant contact, account, conversation, membership, message,
  comment, notification, assignment, resolution, and billing links are rejected by PostgreSQL.
- Current conversation assignment is a nullable projection. Assignment events preserve the prior
  and next assignee independently. A human message stores the authenticated reply author, immutable
  author display snapshot, assignee-at-send ID, and assignee display snapshot separately. Replying
  does not update assignment.
- Resolution events have an optional credit recipient and policy version, without freezing the
  still-unapproved completion-credit policy. A check allows credit only on a resolved event with a
  recorded policy version.
- External messages are unique by connected account, direction, and provider message ID. Outbound
  client idempotency is tenant-scoped. Webhook delivery keys are unique by platform, with processing
  state, attempt count, retry time, ordering metadata, payload hash, and optional ciphertext.
- Outbox records are committed database facts with retry/publication state. No dispatcher or live
  webhook handler was implemented because those belong to later milestones.
- Social comments remain separate from DM conversations. Posts, parent comments, provider IDs,
  internal reply authors, and assignee-at-send facts are explicitly modeled.

RLS is intentionally disabled according to ADR-006/OPEN-014. It must not be enabled until pooled
transaction context is proven safe in Milestone 4. Generic audit targets, notification resources,
outbox aggregates, and idempotency response bodies require application authorization because a
relational database cannot enforce polymorphic references.

## Migration and seed

Migration `20261012184311_initial_business_schema` was created with `--create-only`, reviewed, and
applied to the verified empty `saas_dev.public` schema. It creates only the initial business objects;
the one `DROP CONSTRAINT` replaces a billing foreign key created earlier in that same migration with
its tenant-composite form. Migration `20261012185057_normalize_constraint_names` only renames the
hand-authored composite foreign keys to Prisma's canonical names so schema drift checks remain clean.
No pre-existing data or volume was deleted.

The development seed is idempotent, synthetic, and guarded to exactly `saas_dev` outside production.
See `docs/database-migrations.md` for commands and safeguards.

## Tests and verification

Database integration tests use a dedicated `saas_test` database, apply committed migrations, run
serially, and roll each test back. They cover migration presence, membership uniqueness,
cross-tenant parent/assignee rejection, webhook/message deduplication, assignment versus authorship,
social comment parent isolation, and referential deletion protection.

Local results: Prisma validation/generation passed; both migrations applied; migration status is up
to date; schema drift is empty; all 7 database tests passed; lint, typecheck, unit tests, API e2e,
all production builds (including Android export), formatting, and `git diff --check` passed. GitHub
Actions now starts its existing disposable PostgreSQL and Redis services, applies migrations, and
runs the guarded database suite before other checks. It still requires no Meta credentials and no
existing check was disabled. The workflow was not pushed or remotely executed.

## Manual verification for beginners

1. Start Docker Desktop, open PowerShell in the repository, and run `pnpm.cmd infra:up`.
2. Run `pnpm.cmd db:migrate:status`; confirm it says the database schema is up to date.
3. Run `pnpm.cmd db:validate` and `pnpm.cmd db:generate`.
4. Create a dedicated local `saas_test` database once, set `NODE_ENV=test` and its `DATABASE_URL` as
   shown in `docs/database-migrations.md`, then run `pnpm.cmd test:database`.
5. Optionally run `pnpm.cmd db:seed` against `saas_dev`, then inspect the synthetic records with
   Prisma Studio or SQL. Do not use real customer data or provider tokens.
6. Run the repository regression commands listed below. Stop infrastructure with
   `pnpm.cmd infra:down`; do not add `-v`.

## Open decisions and Milestone 4 prerequisites

- Approve browser credential transport and the detailed endpoint permission matrix.
- Decide whether and how RLS can safely use transaction-local tenant context through Prisma pooling.
- Completion-credit policy remains deliberately unresolved until Milestone 6.
- Retention periods, provider transfer policy, billing provider/enforcement, and custom roles remain
  deferred under the architecture decisions.
- Milestone 4 must implement server-derived tenant context, authorization, active-membership checks,
  secure sessions, and API-level cross-tenant negative tests. This milestone does not begin that work.

## Verification command set

```text
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:status
pnpm test:database
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
git diff --check
```
