# Architecture decisions and open decisions

## Accepted baseline decisions

| ID | Decision | Rationale / consequence |
| --- | --- | --- |
| ADR-001 | Use a pnpm TypeScript monorepo with Next.js, NestJS API, NestJS worker, and Expo app | One repository/contracts while preserving independently deployable processes |
| ADR-002 | Start with a modular monolith, not microservices | Lower operational/transactional complexity; modules/adapters preserve later extraction options |
| ADR-003 | PostgreSQL is authoritative; Redis is disposable coordination infrastructure | Strong transactional source and recoverable queues/realtime projections |
| ADR-004 | Use transactional outbox and idempotent consumers | Enforces persist-before-broadcast and tolerates repeat delivery |
| ADR-005 | Explicit organization context plus tenant-scoped repositories and composite FKs | Defense across transport, application, and relational integrity boundaries |
| ADR-006 | Evaluate PostgreSQL RLS as defense in depth, not primary isolation | RLS helps only if pooled transaction context and policies are proven safe |
| ADR-007 | Keep social comments separate from DM conversations, merge through inbox contract | Preserves different provider semantics without losing unified UX |
| ADR-008 | One nullable current assignee plus immutable events | Fast current lookup, explicit unassigned state, complete history |
| ADR-009 | Store authenticated reply author, assignee-at-send, and immutable display snapshot separately | Accurate audit/analytics even after reassignment/profile changes |
| ADR-010 | Version completion policy and store credit on resolution event | Auditable metrics and no retroactive ambiguity/double counting |
| ADR-011 | Clients use cursor REST sync; Socket.IO is an accelerant | Reconnect/missed-event correctness without trusting transient delivery |
| ADR-012 | Official platform adapters with capability discovery; mocks first | Isolates change and avoids unsupported/live-integration claims |
| ADR-013 | Web and Android share API contracts/client, not database/business logic | Consistency without leaking server authority or secrets |
| ADR-014 | Private object storage with authorized short-lived access | Prevents public cross-tenant media exposure |
| ADR-015 | Fixed initial roles map to granular server permissions | Meets current requirements while allowing future custom-role evolution |
| ADR-016 | UUID internal identifiers and scoped string provider identifiers | Avoids exposing sequential keys and preserves provider fidelity |

## Proposed decisions requiring owner approval

| ID | Decision needed | Recommended default | Decision deadline |
| --- | --- | --- | --- |
| OPEN-001 | Completion-credit v1 policy | Current assignee at resolution; if unassigned, eligible author-resolver; else unattributed | Before Milestone 6 |
| OPEN-002 | Moderator self-assignment ability | Permit self-claim via explicit permission; prevent arbitrary reassignment | Before Milestone 4/7 |
| OPEN-003 | Browser credential transport | HttpOnly secure refresh/session cookie + short access credential and CSRF controls | Milestone 4 design |
| OPEN-004 | Custom roles in first release | Fixed four roles with permission map; defer custom roles | Before Milestone 3 |
| OPEN-005 | Automatic reopen on inbound activity | Reopen resolved item on qualifying customer activity and record source | Before Milestone 7 |
| OPEN-006 | Authored-reply metric threshold | Count persisted human intent; report delivery failures separately | Before Milestone 6 |
| OPEN-007 | Retention/deletion periods | No arbitrary permanent retention; decide by data class/legal need | Before live integrations/production |
| OPEN-008 | Email provider | Select maintained transactional provider based on deployment region/cost | Before live invitations/reset in Milestone 5 |
| OPEN-009 | Hosted object storage/malware scanning | S3-compatible private storage; select vendor/scanner before production | Before attachment deployment |
| OPEN-010 | Push provider | Prefer Expo push initially if capability/compliance fits; reassess direct FCM | Before Milestone 17 |
| OPEN-011 | Hosting/observability/KMS vendors and RPO/RTO | Managed services supporting workers/WebSockets/PITR; proposed RPO 15m/RTO 4h for discussion | Milestone 19 planning |
| OPEN-012 | Billing provider and enforcement | Defer selection; keep provider-neutral placeholders | Before billing in Milestone 19 |
| OPEN-013 | Support access/impersonation | No implicit Super Admin tenant access; require designed audited break-glass/support flow | Before any support-access feature |
| OPEN-014 | RLS implementation | Enable only if Prisma/pooling transaction-context tests prove safe | Milestones 3-4 |

## Version baseline

The exact dependency versions recorded in `docs/setup-checklist.md` are a verified 2026-10-12 proposal. Milestone 2 must re-verify official engine/peer compatibility immediately before creating manifests and document deviations. This architecture does not silently change the approved stack.

## Change process

Material changes receive a new ADR entry with status, date, context, alternatives, security/tenant impact, migration/rollback consequences, and owner approval where product behavior changes. Do not rewrite historical decisions; supersede them.

