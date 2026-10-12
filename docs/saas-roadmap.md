# Complete SaaS Build Roadmap --- Cursor AI / Codex

## How to use this document

Run **one milestone at a time** in Cursor or Codex. Wait for the current
milestone to finish, review its changes, run the stated tests, fix
failures, and commit the work before starting the next milestone. Do not
paste all milestones at once.

### Global instructions --- include these expectations for every milestone

You are working on a commercial, multi-tenant SaaS unified inbox.
Inspect the existing repository before editing. Preserve working
functionality and avoid unnecessary rewrites. Use TypeScript, a Next.js
web app, NestJS API, PostgreSQL + Prisma, Redis + BullMQ, Socket.IO, and
React Native + Expo unless the existing architecture or a documented
compatibility issue requires a change.

The product supports Facebook Messenger, Instagram Direct Messages,
WhatsApp Business Platform, Facebook and Instagram post comments, a
Super Admin dashboard, organization admins/supervisors/moderators,
moderator assignment and performance analytics, and an Android app using
the same backend as the web app.

Non-negotiable requirements: - Enforce strict tenant isolation on the
server for every resource and event. - PostgreSQL is the source of
truth; web and Android use the same backend. - Persist state before
broadcasting real-time events. - Use official platform APIs only. Use
mocks until real credentials and approvals exist. - Keep privileged
secrets and platform tokens server-side; never commit secrets. -
Separate external customer identity, internal moderator authorship, and
current conversation assignment. - Keep one primary current assignee per
conversation (or an explicit unassigned state), with immutable
assignment history. - Any authorized moderator may reply if permitted;
replying must not silently change assignment. - Store actual reply
author from authenticated server identity, never from client-supplied
user IDs. - Separate assignment, authorship, assistance, and completion
credit in analytics. - Social comments are modeled separately from DMs
but appear in the unified inbox with All / Direct Messages / Comments
filters. - Clearly distinguish mock functionality from verified live
integration. - Add appropriate tests, validation, error handling,
documentation, and migrations. - At the end of each milestone, report
files changed, commands actually run, test results, blockers, manual
setup, and whether acceptance criteria passed. Do not claim tests or
integrations succeeded unless verified. - Do not implement future
milestones automatically. Stop after the current milestone.

------------------------------------------------------------------------

# Milestone 1 --- Discovery and architecture

**Prompt**

Act as a senior SaaS architect. Inspect the repository and environment.
Design the architecture for the unified inbox SaaS described in the
global instructions. Document the monorepo structure, services, database
entities and relationships, tenant isolation, roles/permissions,
authentication, channel adapters, webhook processing, queues, real-time
events, moderator attribution and leaderboard rules, Android sharing the
same API, testing, deployment, observability, backups, and risks.
Identify external accounts, permissions, app review, and credentials
required later. Produce an architecture document and ordered milestone
checklist. Do not implement future features yet. Ask only essential
questions; otherwise use safe documented defaults.

## Milestone 2 --- Monorepo and development setup

**Prompt**

Implement the approved monorepo foundation: Next.js web, NestJS API,
Expo React Native app scaffold, shared types/validation/API-client
packages, PostgreSQL + Prisma, Redis + BullMQ, Socket.IO, linting,
formatting, environment validation, and tests. Add local Docker Compose
where suitable, health endpoints, `.env.example` placeholders, useful
scripts, and CI checks for lint/typecheck/tests. Pin compatible
dependencies. Keep secrets out of source control. Ensure apps start
independently. Do not build full business features yet. Run setup checks
and fix failures.

## Milestone 3 --- Database schema and migrations

**Prompt**

Implement the initial Prisma/PostgreSQL schema and migrations for User,
Organization/Tenant, Membership, Roles/Permissions, Invitations,
ConnectedChannelAccount, Contact, Conversation, Message, Attachment,
ConversationAssignment/history, SocialComment, WebhookEvent, AuditLog,
Notification, and future subscription/billing records. Add
relationships, tenant ownership, indexes, constraints, timestamps, and
appropriate soft deletion. Scope external IDs uniquely within the
correct account/platform. Store internal sender identity and an
immutable display-name snapshot or equivalent historical reference.
Record the assignee in effect when a reply is sent where applicable,
separately from the actual author. Preserve assignment history. Make
webhook/message processing idempotent. Avoid unnecessary sensitive data.
Create and test migrations and document key design decisions.

## Milestone 4 --- Authentication, authorization, and tenant isolation

**Prompt**

Implement secure authentication and backend authorization. Support
users, organizations, memberships, and roles such as Super Admin,
Organization Admin, Supervisor, and Moderator. Enforce permissions on
every protected API and verify organization membership on every
tenant-owned resource. Prevent cross-tenant access. Add secure
session/token handling, input validation, rate limiting foundations,
secure CORS, and safe errors. Keep platform tokens server-side and
protect secrets. Add negative tests for unauthenticated requests, role
violations, ID manipulation, and cross-tenant access. Frontend checks
must never be the only security boundary. Document local setup and
production secret requirements.

## Milestone 5 --- Super Admin dashboard and team management

**Prompt**

Build the first functional Next.js dashboard: login/logout, responsive
layout, Super Admin organization/tenant management, users and teams,
invitations, memberships, roles/permissions, organization settings,
connected-account placeholders, and audit-log views. Super Admin actions
must be explicitly authorized; Organization Admins may manage only their
own organization. Use reusable accessible components and proper loading,
empty, validation, and error states. Label mock data clearly and never
imply a platform account is connected when it is not. Add tests for core
admin flows.

## Milestone 6 --- Moderator analytics and leaderboard

**Prompt**

Implement moderator analytics with separate metrics for current
assignments, assignments/reassignments, messages authored,
resolved/completed conversations, reopened conversations, assisted
conversations, response times where data exists, and pending workload.
Maintain one primary current assignee or an explicit unassigned state.
Assignment history must be auditable. Replies do not change assignment.
The server determines message authorship from authenticated identity.
Record the assignment in effect at send time where applicable. Separate
assignment ownership, message authorship, assistance, and completion
credit. Document the completion-credit policy and prevent double
counting. Add date filters, tenant permissions, clear metric
definitions, and tests for reassignment, collaborative replies,
completion, reopening, and calculations.

## Milestone 7 --- Unified inbox backend API

**Prompt**

Implement APIs for conversation lists, cursor-paginated message history,
conversation/contact details, search and filters, read/unread state,
resolution/reopening, assignment/reassignment, sending through channel
adapters, attachments, and delivery status. Include All / Direct
Messages / Comments filters plus channel, assignee, status, unread, and
time filters. Enforce tenant authorization, validate inputs, document
stable response formats, and use idempotency where appropriate.
Distinguish queued/sending/sent/delivered/read/failed only as supported;
backend acceptance is not proof of delivery. Create API documentation,
integration tests, and a mock channel adapter.

## Milestone 8 --- Channel adapter and comment foundation

**Prompt**

Create adapter interfaces for connecting accounts, webhook
verification/receipt, normalized inbound messages, outbound sends,
status events, media, retries, rate limits, comment ingestion, and
supported replies. Keep platform-specific code isolated. Verify webhook
signatures/challenges according to official docs. Persist
idempotency/processing records, safely handle duplicate and out-of-order
events, deletions, unsupported event types, and retries. Use background
queues and safe logs. Keep mock adapters for tests. Implement the
framework, not a claimed live integration. Document each platform's
capability and permission requirements.

## Milestone 9 --- Queues, reliability, and real-time infrastructure

**Prompt**

Implement Redis/BullMQ background processing for webhooks, outbound
sends, retries, media tasks, notifications, and analytics jobs where
appropriate. Implement authenticated Socket.IO events. Persist changes
before broadcasting. Authorize organization/team/conversation rooms
server-side. Use stable event IDs and idempotent client handling.
Recover missed events through REST/cursor sync. Add retry and
dead-letter handling, health checks, and operational metrics. Ensure
retries cannot create duplicates where idempotency is available;
document external exactly-once limitations. Test duplicate events, retry
behavior, unauthorized room access, reconnect recovery, and event
ordering.

## Milestone 10 --- Complete web inbox UI

**Prompt**

Build the Next.js unified inbox: conversation/comment list, search and
filters, contact panel, thread view, reply composer, supported
attachments, read/unread and resolve controls, assignment/reassignment,
channel indicators, delivery status, moderator attribution, and All /
Direct Messages / Comments views. Add responsive layouts and loading,
empty, offline, error, and retry states. Display current primary
assignee separately from each message's actual author. Never confuse
internal moderator identity with the customer or external platform
sender. Reconcile optimistic updates with server responses and prevent
duplicate submissions. Add UI and end-to-end tests.

## Milestone 11 --- Facebook Messenger integration

**Prompt**

Implement Facebook Messenger using current official Meta Messenger
Platform documentation. Configure the Page connection flow, required
permissions, server-side Page token storage, webhook
verification/subscriptions, supported inbound messages, normalized
storage, outbound replies, status events, attachments where supported,
and error/retry handling. Scope every record to the correct organization
and Page. Preserve moderator authorship. Use mocks until authorized
credentials exist. Document Page/app setup, permission and app-review
requirements, and testing. Do not use scraping or unofficial APIs. Do
not claim production readiness until a real authorized test Page
successfully sends and receives messages.

## Milestone 12 --- Instagram DMs and Facebook/Instagram comments

**Prompt**

Implement Instagram messaging and supported Facebook Page/Instagram
media comment management using current official Meta documentation and
the permissions granted to the connected account. For DMs, implement
account eligibility checks, webhooks, inbound normalization, supported
replies, and errors. For comments, create/use a separate SocialComment
model with organization/account, platform, post/media ID, external
comment ID, parent ID, author, text, timestamps, reply state, and
internal reply attribution where available. Ingest supported events and
implement permitted public replies/moderation actions. Handle duplicate
events, edits/deletions, rate limits, and permission failures. Show
comments in the unified inbox under All / Direct Messages / Comments.
Internal moderator badges belong only to this SaaS UI; never claim they
are Meta-provided badges. Document account restrictions and verify
against real authorized test assets before claiming success.

## Milestone 13 --- WhatsApp Business Platform integration

**Prompt**

Implement WhatsApp Business Platform using current official Cloud API
documentation. Support eligible account/phone connection, secure
identifiers/tokens, webhooks, inbound messages, supported text/media
sends, templates where required, supported delivery statuses, rate
limits, errors, and retries. Respect messaging windows, templates,
recipient consent, and Meta policies. Scope data to the correct
tenant/account and preserve moderator attribution. Use mocks until
authorized credentials and test setup are available. Document setup,
business/phone requirements, template requirements, permissions, and
current pricing considerations. Never claim delivery before provider
confirmation.

## Milestone 14 --- Shared client and mobile authentication

**Prompt**

Prepare a typed shared API client and reusable validation/types for web
and Android. Implement secure mobile authentication, session
expiry/refresh, organization selection if needed, cursor-based sync,
Socket.IO authentication, consistent permission handling, uploads, and
normalized errors. Both clients must use the same NestJS backend and
PostgreSQL source of truth. Do not create a separate mobile-only
database or duplicate business rules. Keep secrets out of mobile
bundles. Use suitable OS-backed secure storage for sensitive tokens, not
AsyncStorage. Add auth/API compatibility and tenant-isolation tests.

## Milestone 15 --- Expo Android application

**Prompt**

Build the Android app with React Native and Expo: login/logout,
organization selection if applicable, inbox, search/filters,
conversation and comment threads, reply composer, assignment display and
authorized controls, moderator attribution, read/unread and resolution
controls, status indicators, and settings. Reuse the shared API client.
Show actual reply author separately from current assignee. Include
loading, empty, offline, reconnecting, and error states. Add navigation
and API tests. Document emulator and physical-device setup. Use clearly
labeled mock data only where necessary.

## Milestone 16 --- Web/Android real-time synchronization

**Prompt**

Complete and test bidirectional real-time synchronization between web,
Android, moderators, and authorized admin views. Synchronize messages,
assignments, unread/read state, resolution/reopening, comments/replies,
attribution, and supported delivery statuses. Persist changes before
broadcasting. Authenticate sockets and authorize tenant/conversation
rooms. Deduplicate events and recover missed updates through REST/cursor
sync. Prevent duplicate messages when optimistic updates and socket
events arrive in either order. Test web-to-Android and Android-to-web
messages, assignment updates, comment updates, unauthorized room access,
duplicate events, and reconnect recovery. Document foreground real-time
versus background push-notification behavior.

## Milestone 17 --- Notifications and Android builds

**Prompt**

Implement relevant in-app and Android push notifications for new
messages, assignments, reassignment, and important failures. Use a
suitable push provider if needed. Protect device tokens, handle invalid
tokens, respect permissions/preferences, and avoid sensitive message
content in notifications unless explicitly configured with appropriate
safeguards. Configure development builds, a test APK, and a Play Store
AAB using Expo/EAS or a compatible workflow. Document package ID,
signing, versioning, environment configuration, and release steps. Keep
signing keys/secrets out of source control. Test on a physical Android
device. Do not claim Play Store publication unless completed.

## Milestone 18 --- Complete security hardening

**Prompt**

Act as a senior application security engineer. Inspect the actual code
and configuration first, then implement and test applicable controls
across Next.js, NestJS, PostgreSQL/Prisma, Redis/BullMQ, Socket.IO,
platform integrations, file storage, CI/CD, and Android. Use OWASP ASVS,
OWASP API Security Top 10, and OWASP MASVS as references; do not claim
certification.

Cover: 1. SQL injection: parameterized queries, safe raw SQL, input
validation, least-privilege DB roles. 2. XSS: context-aware output
encoding, safe rendering, sanitization for allowed rich HTML, CSP. 3.
CSRF: appropriate protection for cookie-authenticated state-changing
requests; secure cookie attributes; do not rely on CORS alone. 4. Broken
object/function/property-level authorization: server-side checks on
every resource/action; tenant isolation tests. 5. Authentication:
Argon2id or suitable password hashing, strong JWT secrets,
signature/issuer/audience/expiry validation, refresh-token
rotation/revocation, session invalidation. 6. MFA: secure TOTP or
maintained implementation, one-time recovery codes, rate limits,
protected reset flows; prioritize privileged accounts. 7.
Tokens/secrets: no privileged platform tokens in browser/mobile bundles;
no tokens in URLs/logs; rotate exposed credentials. 8. File uploads:
allowlisted formats, size/signature validation, safe names, private
storage, per-tenant authorization, safe downloads, optional malware
scanning. 9. Rate limits: login, MFA, invitations, messages, comments,
uploads, search, admin actions, and webhooks; use shared/distributed
limits where needed. 10. CORS/headers: explicit production origin
allowlist, safe credential policy, CSP, HSTS when HTTPS is configured,
clickjacking protection, no debug endpoints/default credentials. 11.
PostgreSQL RLS: evaluate as defense in depth; implement only with safe
tenant context, transaction/connection-pool handling, least-privilege
roles, and tests. Document any exception. 12. Webhooks: verify provider
signatures/challenges, validate payloads, deduplicate, rate-limit, and
never trust unverified events. 13. SSRF: validate remote URLs, block
private/loopback/link-local/metadata destinations where appropriate,
revalidate redirects/DNS, restrict outbound network, and limit
time/size. 14. Build artifacts: avoid public source maps unless
intentionally restricted; remove test bypasses, demo accounts, default
credentials, and debug routes; rotate exposed secrets. 15.
Logging/privacy: redact credentials and unnecessary personal/customer
data; secure audit trails and retention. 16. Dependencies/supply chain:
audit, safely update vulnerable dependencies, scan secrets, review
containers/build artifacts, and generate an SBOM if appropriate. 17.
Android: secure OS-backed token storage, HTTPS, safe deep
links/files/notifications/backups, release configuration, no privileged
secrets in bundle. 18. Realtime/workers: authorize socket rooms, protect
Redis, validate jobs, and make retries safe. 19. CI/security tests: add
appropriate static analysis, dependency/secret scanning, and tests for
authorization, SQL injection, XSS, CSRF, SSRF, uploads, webhook
signatures, rate limits, and sockets. 20. Test only owned or explicitly
authorized environments; never run destructive tests against production
without approval.

Work in manageable batches and run regression tests after each. Report
evidence, severity, remediation, commands/results, residual risks, and
manual configuration. Do not merely write recommendations---implement
applicable fixes. Do not deploy to production in this milestone.

## Milestone 19 --- Production deployment and SaaS readiness

**Prompt**

Prepare staging and production deployment for Next.js, NestJS API,
PostgreSQL, Redis/BullMQ workers, Socket.IO, webhook endpoints, private
attachment storage, and Android configuration. Choose hosting that
supports persistent workers and WebSockets. Configure separate
environments, HTTPS/TLS, domains, secure secrets, migrations/rollback,
least-privilege networking, database backups and recovery tests,
monitoring/logging/alerts, health checks, webhook URLs, rate limits,
retention/deletion procedures, and deployment runbooks. Verify
production builds do not expose secrets or development endpoints.
Prepare Meta app review and permission checklists. Add
subscription/billing integration only after selecting a provider and
document server-side tenant billing enforcement. Deploy to staging, test
core workflows, and document unresolved setup. Do not claim production
readiness until verified.

## Milestone 20 --- Final pre-production security audit

**Prompt**

Act as an independent security reviewer. Verify the actual
implementation after Milestone 18 and the staging/deployment
configuration from Milestone 19. Do not assume previous fixes succeeded.
Review web, API, database, tenant isolation, queues, sockets, platform
integrations, attachment storage, Android release build, CI/CD, and
secrets. Test applicable OWASP ASVS/API Security Top 10/MASVS controls.
Verify role and cross-tenant access, authentication/MFA/session
invalidation, SQL injection, XSS, CSRF where applicable, SSRF, file
uploads, rate limits, webhook signatures, socket authorization, logging,
dependency vulnerabilities, TLS/CORS/headers, source maps, default
credentials, backups, and recovery. Use staging and authorized test
accounts. Retest fixed findings. Report severity, evidence, affected
component, remediation status, residual risks, commands/results, and a
release recommendation of Blocked, Conditional, or Ready for Release.
Block release for unresolved critical/high exploitable risks unless an
explicitly reviewed exception and effective mitigation exist. Do not
claim zero vulnerabilities, certification, or automatic publication.
Require human approval before release.

------------------------------------------------------------------------

## Final operating rule

Finish one milestone, review the diff, run tests, fix failures, and
commit the changes before starting the next. If a milestone is
incomplete, ask Cursor/Codex to finish that same milestone instead of
moving ahead. Real Meta/WhatsApp integration requires eligible accounts,
permissions, credentials, and sometimes app review; mocks are not proof
of a working live integration.
