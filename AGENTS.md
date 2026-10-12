# Codex Project Instructions

You are developing a commercial multi-tenant SaaS unified inbox.

Read `docs/saas-roadmap.md` before making architectural or implementation decisions.

## Technology stack

- TypeScript
- Next.js web frontend
- NestJS backend API
- PostgreSQL and Prisma
- Redis and BullMQ
- Socket.IO
- React Native and Expo
- pnpm workspaces
- Docker Compose

## Core requirements

- Strict server-side tenant isolation.
- Role-based permissions for Super Admin, Organization Admin, Supervisor, and Moderator.
- Facebook Messenger, Instagram DMs, WhatsApp Business, and supported social comments through official APIs.
- One current primary conversation assignee, with immutable assignment history.
- Separate moderator message authorship from conversation assignment.
- Accurate moderator analytics and completion-credit rules.
- Shared backend and PostgreSQL database for web and Android.
- Persist changes before broadcasting real-time events.
- Use mock platform adapters until authorized credentials are available.
- Keep secrets and platform tokens server-side.

## Development rules

1. Inspect the existing repository before editing.
2. Follow the milestone order in `docs/saas-roadmap.md`.
3. Work on only the explicitly requested milestone.
4. Do not automatically start the next milestone.
5. Use compatible, pinned dependencies.
6. Add validation, error handling, tests, and documentation.
7. Never delete existing files or data without authorization.
8. Never commit secrets.
9. Never claim a test passed unless it was actually executed.
10. Report changed files, executed commands, test results, blockers, and manual setup after each milestone.
11. Explain manual verification steps for a beginner.
12. Ask before destructive commands, global installations, or external deployments.

## Completion criteria

A milestone is complete only when its acceptance criteria have been checked, relevant tests pass, and any remaining limitations are clearly documented.
