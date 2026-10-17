# Single-business product plan

## Status and purpose

This document records the product direction selected during Milestone 5: a private social media
management system for one owner-operated business. It supplements, rather than rewrites,
`docs/saas-roadmap.md` and the Milestone 1 architecture documents. Those files remain the historical
design baseline and retain useful security and messaging decisions.

No schema contraction is required. The deployed product designates one existing `Organization` as
the business workspace. Existing organization boundaries remain a defense-in-depth boundary and a
compatibility mechanism for tests, maintenance, and any future migration.

## Product goals

- Give one business owner a secure workspace for Facebook, Instagram, WhatsApp Business, and
  supported social comments.
- Let the owner invite moderators, organize teams, manage permissions, and review administrative
  activity.
- Provide one unified inbox for direct messages and comments without confusing external senders,
  internal reply authors, current assignees, or completion credit.
- Provide accurate moderator and team performance reporting after the underlying events exist.
- Serve the web and Android clients from the same NestJS API and PostgreSQL source of truth.
- Use official Meta APIs only and describe an account as connected only after authorization and
  verification.

Public business registration, customer-created workspaces, subscriptions, tenant billing, and a
customer-facing Super Admin console are outside the intended everyday product.

## Architecture decision

One selected organization is the business workspace. `Organization`, `Membership`, and every
tenant-scoped `organization_id`, composite foreign key, index, guard, and service boundary remain
unchanged. Existing platform routes remain available for explicitly authorized maintenance, but
they are not linked from the normal business navigation.

This is intentionally not a second authorization system. Requests continue to authenticate a
`User`, resolve an active `Membership` for the organization route, derive permissions on the
server, and use a `TenantContext`. A `SUPER_ADMIN` still has platform permissions only and receives
no implicit access to the business workspace.

The current development database contains more than one organization. Selecting or renaming the
designated business workspace requires owner confirmation; no database record is selected merely
by this document.

## Roles

| Product role               | Existing stored role | Responsibilities                                                                                                                                                    |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy platform maintainer | `SUPER_ADMIN`        | Explicit platform maintenance routes only; not everyday business administration and not implicit workspace access.                                                  |
| Owner/Admin                | `ORGANIZATION_ADMIN` | Manage the business profile, moderators, roles, teams, invitations, social-account metadata, activity logs, and authorized analytics.                               |
| Supervisor                 | `SUPERVISOR`         | Read members and teams, coordinate permitted assignments and moderation, and view authorized team analytics. No owner-only settings, invitations, or role mutation. |
| Moderator                  | `MODERATOR`          | Work permitted inbox items, send authorized replies, resolve permitted conversations, and view personal performance. No administrative privileges.                  |

Backend guards and role-derived permissions remain authoritative. Navigation visibility is only a
usability feature and is never the security boundary.

## Owner workspace navigation

The normal Owner/Admin navigation is:

1. Dashboard
2. Unified Inbox (upcoming; no fabricated messages)
3. Moderators (existing member and invitation workflows)
4. Teams (existing team APIs and UI)
5. Analytics & Leaderboard (upcoming Milestone 6; no fabricated metrics)
6. Social Media Accounts (existing connection-metadata view)
7. Activity Logs (existing organization audit log)
8. Settings (existing organization settings)
9. My Account

Legacy platform routes are preserved for maintenance compatibility but hidden from the everyday
sidebar. Existing organization routes are also retained so bookmarks and tests continue to work.

## Social media connection requirements

Each real connection must use an eligible owner-controlled Meta asset and the current official API:

- Facebook Messenger and supported Facebook comments require an authorized Facebook app, Page,
  permissions, webhook subscription, appropriate app mode/review, and a test Page.
- Instagram messaging and comments require an eligible professional account and the account/Page
  linkage, permissions, webhooks, and review required by the current Meta API.
- WhatsApp requires an authorized business portfolio/WABA, phone number, access arrangement,
  webhooks, consent, messaging-window compliance, and approved templates where required.

Provider tokens remain server-side and encrypted in hosted environments. OAuth, webhook receipt,
message synchronization, and real outbound delivery are not implemented in Milestone 5. Existing
metadata must therefore continue to say `Not connected` unless an authorized record actually
exists; stored metadata alone is not proof that live synchronization works.

## Unified inbox requirements

- Present direct-message conversations and comment threads in one product surface with All,
  Direct Messages, and Comments filters.
- Retain separate persistence models where provider behavior differs.
- Support channel/account, assignee, status, unread, and time filters with stable cursor pagination.
- Authorize every list, detail, search, mutation, attachment, socket room, and sync operation against
  the active business membership on the server.
- Persist authoritative state and an outbox event before broadcasting realtime changes.
- Treat provider delivery states only as confirmed by the provider; API acceptance is not delivery.

## Assignment and authorship rules

- A conversation has one current primary assignee or an explicit unassigned state.
- Every assignment or reassignment creates immutable history.
- An authorized moderator may reply without silently becoming the assignee.
- The server derives the reply author from the authenticated membership; clients never supply an
  authoritative author ID.
- The assignee at send time is recorded separately from actual authorship.
- Assignment ownership, assistance, reply authorship, resolution action, and completion credit are
  separate facts.
- The same principles apply to supported comment replies.

## Moderator performance and leaderboard

Milestone 6 may add organization-scoped date filters and definitions for current workload,
assignments/reassignments, messages authored, resolved/completed conversations, reopened work,
assistance, response times where evidence exists, and pending work. It must document a versioned
completion-credit policy, avoid double counting, and test reassignment and collaborative replies.

No analytics are calculated or displayed as real in this Milestone 5 alignment.

## Android scope

The Expo Android application will use the shared API client and the same backend/database. Its
scope includes secure sign-in, the designated workspace, inbox filters and threads, authorized
reply and assignment controls, separate author/assignee presentation, read/unread and resolution
controls, realtime recovery, offline/error states, settings, and notifications when implemented.
Sensitive mobile credentials use OS-backed secure storage; privileged Meta tokens never ship in
the application.

## Existing functionality to preserve

- Cookie authentication, refresh rotation, CSRF protection, safe errors, and rate-limit foundation.
- Platform authorization and tenant membership authorization as separate guards.
- Organization/member/team/invitation/settings/audit and integration-metadata APIs.
- Tenant-scoped schema, composite relationships, assignment/resolution history, idempotency,
  webhook/outbox records, and audit records.
- Super Admin denial for implicit tenant access and moderator denial for administrative mutations.
- All applied migrations, existing accounts and organizations, tests, and old route compatibility.

## Features no longer needed in everyday use

- Public organization signup or self-service workspace creation.
- Multiple customer workspace administration as an owner workflow.
- Subscription plans, customer billing, and SaaS sales flows.
- Routine use of platform organization/user/audit pages by the business owner.

Their existing schema placeholders and maintenance APIs are not deleted during this alignment.

## Updated remaining milestone plan

1. **Milestone 5 review and owner setup:** approve the designated organization and owner email,
   provision one dedicated `ORGANIZATION_ADMIN` with the existing development-only CLI, and verify
   the owner and moderator browser flows. Do not modify the global Super Admin.
2. **Milestone 6 - moderator analytics:** implement the documented metrics and leaderboard only
   from authoritative organization events, with role and cross-organization tests.
3. **Milestone 7 - unified inbox API:** implement tenant-authorized list/detail/search, assignment,
   read state, resolution, sending contracts, attachments, idempotency, and mock adapters.
4. **Milestones 8-9 - adapters and reliability:** implement verified webhook boundaries,
   normalization, BullMQ processing, transactional outbox delivery, retries, and authorized
   Socket.IO rooms.
5. **Milestone 10 - web inbox:** build the complete owner/supervisor/moderator inbox UI against the
   real API, with empty/loading/error/offline states and no fake customer data.
6. **Milestones 11-13 - owner Meta integrations:** connect and verify the owner's eligible Facebook,
   Instagram, and WhatsApp assets individually using current official documentation and approvals.
7. **Milestones 14-17 - shared client, Android, realtime, and notifications:** retain one backend and
   source of truth, add secure mobile storage, reconnect recovery, and authorized notifications.
8. **Milestones 18-20 - hardening and release:** complete security remediation, single-business
   deployment/runbooks/backups, authorized staging checks, and an independent pre-production audit.

The original roadmap remains authoritative historical documentation where this plan does not
explicitly narrow the product surface. Work must still stop after each reviewed milestone.
