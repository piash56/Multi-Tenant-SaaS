# Security and operations

## Security baseline by design

Security begins in Milestones 2-4 and is expanded continuously; Milestone 18 is verification and hardening, not the first implementation.

### Application controls

- Runtime validation for HTTP, webhook, socket, job, environment, and adapter boundaries; reject unknown/oversized input as appropriate.
- Server-side tenant and permission checks on every resource/action, with negative ID-substitution tests.
- Prisma parameterization by default; tightly review unavoidable raw SQL and never concatenate untrusted input.
- React output escaping by default; no unsafe HTML without a maintained sanitizer and explicit content policy. Deploy CSP and other security headers early.
- Cookie-authenticated mutations receive CSRF defenses; explicit production CORS origin allowlists do not replace them.
- Safe errors expose stable codes/request IDs, not stack traces, provider tokens, SQL, or cross-tenant existence.
- Distributed rate limits cover login/refresh/reset/invitations, search, uploads, replies/comments, admin actions, sockets, and webhook abuse while accounting for trusted proxy configuration.

### Upload and integration controls

- Private object storage, random keys, tenant metadata authorization, short-lived download grants, allowlisted size/type/signature, scan/quarantine workflow, and retention cleanup.
- Verify webhook signatures over correct raw bytes before processing; dedupe and rate-limit verified/unverified paths safely.
- Guard provider media retrieval against SSRF, redirects/DNS rebinding, internal/metadata addresses, unbounded content, and decompression hazards.
- Encrypt provider/refresh secrets with versioned managed keys and least-privilege runtime access; rotate and audit access.

### Infrastructure controls

- Separate accounts/projects/networks/secrets per environment; production data never populates development casually.
- TLS at every public boundary; restricted database/Redis/storage networks; no public PostgreSQL/Redis.
- Least-privilege runtime, migration, backup, and operator identities. Containers run non-root where practical with read-only/minimal filesystems and pinned images/digests.
- CI uses protected environments, pinned actions/tooling, secret scanning, dependency/container scanning, lockfile enforcement, artifact provenance/SBOM where appropriate, and no untrusted-code access to deployment secrets.
- Mobile signing, Meta secrets, database credentials, encryption keys, and backup keys live in approved secret managers, never Git or client bundles.

## Audit and privacy

Append-only audit logs cover authentication/security lifecycle, memberships/roles, organization/channel changes, assignments/resolutions, exports/deletion, token operations, support access, and Super Admin actions. Record actor, tenant/scope, action, target, result, request/correlation ID, timestamp, and a safe minimal change summary. Protect audit access and integrity; never log passwords, raw tokens, signing secrets, full authorization headers, or unnecessary message content.

Define data classification, retention, deletion, export, legal-hold, and regional requirements before production. Customer content and identifiers are personal/sensitive data. Logs/metrics should use internal IDs and redaction; high-cardinality or content-bearing labels are prohibited.

## Observability

- Structured JSON logs with correlation/event/job IDs and environment/service/version.
- Metrics for API latency/error/auth denials/rate limits; database saturation/slow queries; Redis health; queue/outbox depth/age/failures; webhook validity/latency; provider errors/rate limits; socket connections/reconnects; notification failures; and security anomalies.
- Distributed traces across API, database, queues, and adapters with content/token redaction.
- Alerts map to runbooks, severity, ownership, and escalation. Avoid alerting on expected user errors.
- Health endpoints distinguish liveness from readiness and do not reveal configuration/secrets. Dependencies are tested appropriately without causing cascading failure.

## Backups and recovery

- Managed PostgreSQL automated backups plus point-in-time recovery where available, encrypted with access separation.
- Define business-approved RPO/RTO in Milestone 19; initial design target for discussion: RPO <= 15 minutes and RTO <= 4 hours, not a guarantee.
- Regular restore drills into an isolated environment verify schema, application smoke tests, tenant counts/integrity, and documented timing. A backup is not considered verified until restored.
- Object storage needs versioning/lifecycle and recovery aligned with database references. Redis is reconstructable; queue/outbox recovery procedures originate from PostgreSQL and dead-letter records.
- Backup retention/deletion must account for tenant deletion and legal obligations.

## Deployment and change management

Use development, test/CI, staging, and production. Promote immutable artifacts; inject runtime secrets; run backward-compatible expand/migrate/contract database changes; deploy API/workers safely around schema versions; and support rollback or forward-fix. Mobile API evolution stays backward compatible through supported app versions. Destructive migrations require backup, rehearsal, explicit approval, and runbook.

## Threat-driven test baseline

From Milestones 2-4 onward automate authentication/RBAC/tenant negative cases, injection/validation, CSRF/CORS/header behavior, rate limits, webhook signatures/replays, job/socket authorization, upload bypass, SSRF, secret exposure, and dependency checks as relevant. Milestone 18 assesses OWASP ASVS/API Security Top 10/MASVS controls against actual code; Milestone 20 independently retests staging. Neither claims certification or zero vulnerabilities.

## Incident response

Before production, create procedures for account/token compromise, cross-tenant exposure, malicious uploads, webhook spoofing, provider outage/rate limit, queue backlog, database/Redis outage, lost mobile signing key, and data restore. Preserve evidence, revoke/rotate credentials, bound impact by tenant, communicate through approved channels, and conduct corrective reviews.

