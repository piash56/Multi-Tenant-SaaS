# Milestone dependencies and acceptance plan

## Dependency review summary

Preserve milestones 1-20 and their numbering. The roadmap is workable, but several foundations must begin earlier than the milestone title might imply:

- Tenant columns/constraints begin in Milestone 3 and enforcement/negative tests in Milestone 4; they cannot wait for Milestone 18.
- Authentication/session schema must exist in Milestone 3 and implementation in Milestone 4 before the dashboard in Milestone 5.
- Analytics facts and versioned completion policy must be represented in Milestone 3, even though reporting is Milestone 6.
- The Milestone 7 inbox needs a mock adapter contract. Implement the minimal mock/port there without stealing the full adapter/webhook framework from Milestone 8.
- Attachments in Milestone 7 need storage abstractions and security controls early; production vendor/scanning can wait.
- Persist-before-broadcast needs an outbox table in Milestone 3; full BullMQ/Socket.IO operations remain Milestone 9.
- Shared contracts/client foundations start in Milestone 2 and evolve continuously; Milestone 14 completes mobile-specific auth/sync rather than creating sharing from scratch.
- Notifications need data/schema foundations before Milestone 17; push delivery/build work stays in 17.
- Baseline validation, CSRF/CORS/headers, rate limiting, audit, secret handling, upload/webhook controls, and isolation tests occur in their feature milestones. Milestone 18 hardens and verifies them.
- Deployment concerns (environment schemas, health, migrations, logs) begin in Milestone 2/9. Provider/vendor selection and staging deployment remain Milestone 19.

## Ordered dependency table

| Milestone | Depends on | Foundation/check that must be satisfied | External blockers |
| --- | --- | --- | --- |
| 1 Architecture | 0 | This documentation set approved; open product policies acknowledged | None |
| 2 Monorepo/setup | 1 | Reverify pins; scaffold apps/packages; env validation, CI, health/test skeletons | None; no Meta credentials |
| 3 Database | 2 | Tenant keys/composite FKs, auth sessions, outbox/idempotency, analytics facts, billing placeholders | None |
| 4 Auth/RBAC/isolation | 3 | Server context/policies, session rotation, cross-tenant tests, CSRF/CORS/rate baseline; decide browser auth/RLS | Email sandbox optional |
| 5 Admin/team | 4 | Authenticated UI and APIs; invitation/audit behavior | Email provider needed only for real delivery |
| 6 Analytics | 3-5 | Owner approves completion policy and metric inclusion; reconciliation tests | None |
| 7 Inbox API | 3-4, adapter port | Mock send adapter, secure attachment abstraction, idempotent commands | Object-store mock/local option sufficient |
| 8 Adapter/comments | 3-4,7 | Verified webhook boundary, normalized contracts, comment model, mocks | Official docs current; credentials not required |
| 9 Queues/realtime | 3-4,7-8 | Outbox dispatch, Redis/BullMQ, room auth, retry/DLQ/sync tests | Hosting not required locally |
| 10 Web inbox | 5,7,9 | Stable APIs/events/capabilities and UI reconciliation | None with mocks |
| 11 Messenger | 8-10 | Adapter contracts and operational controls | Meta app/Page/permissions/review/test assets |
| 12 Instagram/comments | 8-11 as shared learning | Separate comment data/UI and capabilities | Eligible IG/Page assets, permissions/review |
| 13 WhatsApp | 8-10 | Adapter framework and policy-aware sends | WABA/phone/templates/consent/permissions |
| 14 Shared client/mobile auth | 2,4,7,9 | Stable client/auth/sync/upload contracts | SecureStore library compatibility |
| 15 Android app | 10,14 | Mobile API/auth/navigation/offline foundation | Emulator/device for verification |
| 16 Cross-client realtime | 9-10,15 | Web/mobile event parity and recovery tests | Devices/test environment |
| 17 Notifications/builds | 14-16 | Notification preferences/tokens, background behavior | Expo/FCM/EAS, signing, Play assets, physical device |
| 18 Security hardening | 2-17 | Retest and remediate actual implementation; no deferred baseline controls | Security tooling/accounts as selected |
| 19 Deployment/readiness | 18 | Hosting, secrets/KMS, storage, backups/restore, monitoring, runbooks, staging | Vendors/domains/TLS/Meta review/billing choice |
| 20 Independent audit | 19 | Staging evidence, restore/config/build verification, remediation retest | Authorized staging/test accounts and human release decision |

## Architectural conflicts or ambiguity

1. **Milestone 6 before inbox backend (7):** analytics can be implemented/tested against domain services and seeded facts, but production-generating inbox actions arrive later. Milestone 6 should define projections/calculations without building Milestone 7 endpoints; Milestones 7-13 add facts through the same services and regression tests.
2. **Milestone 7 requests a mock channel adapter before adapter foundation (8):** define the minimal interface/mock needed for outbound API tests in 7; general webhook/capability framework remains 8.
3. **Milestone 14 says “prepare” a shared client although Milestone 2 already creates it:** Milestone 2 supplies the package skeleton and basic health/auth-free transport; subsequent API milestones add contracts; 14 hardens mobile refresh, secure storage, sync, and compatibility.
4. **Milestone 18 title may imply late security:** roadmap text itself requires earlier controls. Each milestone owns applicable prevention/tests; 18 is comprehensive hardening.
5. **Future billing listed in database design but provider chosen in 19:** use minimal provider-neutral organization subscription/billing-event placeholders in 3; do not implement payment flows or enforcement early.

These are execution clarifications, not changes to original numbering or automatic roadmap edits.

## Cross-cutting exit gates

Every implementation milestone must report files changed, commands and actual results, tests not run, blockers, manual setup, external/mock status, and acceptance result. In addition:

- No tenant feature passes without server-side cross-tenant negative tests.
- No external/realtime effect passes if it can broadcast before commit.
- No channel passes as live based only on mocks.
- No analytics feature passes without duplicate/reassignment/collaboration/reopen cases.
- No mobile feature may create authoritative parallel data or store privileged secrets.
- No production readiness claim precedes backup restore, staging workflows, security retest, and human approval.

## Milestone 1 acceptance criteria

- All 14 required architecture documents exist and are internally linked by consistent concepts.
- Architecture covers monorepo, entities/constraints, tenant enforcement, auth/RBAC, inbox/comments, assignments/analytics, adapters, realtime/queues, Android, security/operations, external needs, decisions, and dependencies.
- Original milestone numbering is preserved and conflicts/dependencies are documented rather than silently rewriting the roadmap.
- Assumptions and unresolved decisions are explicit.
- No application scaffold, dependency install, container/migration, feature, external API call, deployment, commit, or Milestone 2 work occurred.

## What Milestone 2 will do after approval

Reverify the proposed compatibility baseline, create the pnpm workspace and four app/package foundations, configure strict TypeScript/lint/format/test/CI/environment validation, add local project-scoped PostgreSQL/Redis Compose definitions without touching the existing old container, define health endpoints and scripts, pin dependencies/lockfile, and prove each app starts/builds/tests as applicable. It will not implement business features or start Milestone 3.

