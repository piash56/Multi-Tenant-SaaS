# Milestone 2 report

Date: 2026-10-12  
Status: Complete, subject to the explicitly unverified external checks below.

## Outcome

The repository now contains the approved modular-monolith pnpm workspace: a Next.js web app, a
NestJS API, a NestJS/BullMQ worker, an Expo Android-oriented app, four intentionally small shared
packages, project-scoped PostgreSQL and Redis infrastructure, and a non-deploying CI workflow.
Milestone 3 entities, migrations, authentication, tenant logic, social integrations, inbox logic,
and production jobs were not implemented.

The Prisma schema is deliberately model-free. Prisma 7 still generates a client and validates and
connects without introducing a technical migration that Milestone 3 would later have to unwind.

## Compatibility decisions

- Runtime baseline: Node.js 22.17.1 and pnpm 10.34.7.
- Next.js 16.4.0, React/React DOM 19.2.3.
- NestJS 12.1.3. The apps were scaffolded directly because current Nest CLI code generation
  requires a newer Node 22 patch than the approved machine currently has; the runtime is compatible.
- Prisma, Prisma Client, and the PostgreSQL adapter 7.10.0. The current stable Prisma 7 line was
  chosen instead of the Prisma 8 release candidate.
- Expo SDK 57.0.28, React Native 0.86.3, and React 19.2.3, using Expo-compatible native package
  versions. This replaces the earlier planning estimate of React Native 0.87.
- ESLint 9.39.5 is pinned because the Expo/React Native lint dependency graph does not yet accept
  ESLint 10. Recheck this constraint during routine dependency maintenance.
- Docker images: `postgres:18.6-bookworm` and `redis:8.10.0-alpine`.
- pnpm's hoisted linker is checked in because reconstructing this Expo-heavy workspace with the
  isolated linker consumed excessive memory on the verified Windows host.

All direct external dependency pins are recorded in the workspace `package.json` files and the
complete transitive graph is fixed by `pnpm-lock.yaml`.

## Implemented foundations

- Strict TypeScript, shared compiler configuration, ESLint, Prettier, EditorConfig, and root scripts.
- Next.js App Router shell, responsive styling, home/status routes, error/loading/not-found
  boundaries, security headers, and typed API client usage.
- NestJS validated configuration, allowlisted CORS, global DTO validation, safe HTTP errors,
  structured/redacted logging, Swagger, graceful shutdown, Prisma and Redis modules, and separate
  liveness/readiness endpoints.
- A safe Socket.IO `/realtime` namespace with lifecycle handling and no tenant-room subscription or
  sensitive business broadcast.
- A BullMQ `foundation` queue and processor with no business jobs, plus dependency readiness logging
  and graceful shutdown.
- Expo navigation shell, basic home/status screens, public environment configuration, and shared API
  client usage.
- Loopback-only host publishing for PostgreSQL and Redis, health checks, internal Compose network,
  and persistent named volumes. No fixed `container_name` is used.
- CI installation from a frozen lockfile, Prisma generation/validation, lint, typecheck, unit and API
  integration tests, builds, and formatting checks. CI has no deployment step or Meta credentials.

## Verification results

| Check                                 | Result                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`      | Passed with pnpm 10.34.7; shared-package postinstall passed                 |
| Prisma generate and schema validation | Passed; Prisma 7.10.0, no models or migrations                              |
| Prisma PostgreSQL connection          | Passed against project PostgreSQL                                           |
| Docker Compose services               | PostgreSQL and Redis both `healthy`                                         |
| Lint                                  | Passed across all eight workspace projects                                  |
| Typecheck                             | Passed serially across all eight workspace projects                         |
| Unit tests                            | Passed: validation 2, API environment 3, worker environment 2, API client 1 |
| API integration                       | Passed: 2 tests covering liveness and dependency readiness                  |
| Shared package builds                 | Passed for all four packages                                                |
| API build                             | Passed                                                                      |
| Worker build                          | Passed                                                                      |
| Next.js production build              | Passed; `/`, `/status`, and `/_not-found` generated                         |
| Expo Android export                   | Passed; 916 modules bundled and Android output emitted                      |
| Runtime API smoke test                | Passed: liveness/readiness returned healthy; Swagger returned HTTP 200      |
| Runtime web smoke test                | Passed: `/` and `/status` returned HTTP 200                                 |
| Runtime worker smoke test             | Passed: worker reported PostgreSQL and Redis ready                          |
| Formatting and `git diff --check`     | Passed                                                                      |

The managed command shell intermittently produced `uv_os_get_passwd ... ENOMEM` and prevented
loopback/Docker access. The affected read-only database and integration checks were rerun outside
that boundary and passed. One database check initially used a mistyped local username/password and
failed authentication; rerunning with the documented Compose values passed. A managed-shell API
integration run timed out while opening loopback dependencies; the same pinned test outside that
boundary passed in 3.07 seconds.

## Runtime status and URLs

At final verification:

- `multi-tenant-saas-postgres-1`: healthy, `127.0.0.1:5433 -> 5432`.
- `multi-tenant-saas-redis-1`: healthy, `127.0.0.1:6379 -> 6379`.
- The unrelated stopped container named `postgres` was not started, removed, or modified.

Applications are intentionally not left running. When started:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Liveness: `http://localhost:3001/health/live`
- Readiness: `http://localhost:3001/health/ready`
- Swagger: `http://localhost:3001/docs`
- Expo/Metro: normally `http://localhost:8081`, with device connection details printed by Expo

## Beginner start and stop

1. Open Git Bash in the repository and run `pnpm install --frozen-lockfile`.
2. Copy the example environment files as shown in `docs/local-development.md`.
3. Run `pnpm db:generate`, then `pnpm infra:up`.
4. Open separate terminals and run `pnpm dev:api`, `pnpm dev:worker`, and `pnpm dev:web`.
5. Optionally run `pnpm dev:mobile` and follow Expo's Android emulator or physical-device prompts.
6. Stop each app with Ctrl+C. Run `pnpm infra:down` to stop project infrastructure while preserving
   its named volumes. Never add `-v` unless volume deletion has been explicitly approved.

## Unverified or external checks

- The Android bundle/export passed, but no Android Studio emulator or physical Android device was
  available for interactive UI/network testing.
- The GitHub Actions workflow exists and its constituent commands passed locally; it was not pushed
  or executed by GitHub Actions because committing/pushing is outside this milestone authorization.
- Production deployment, production secrets, TLS, managed PostgreSQL/Redis, backups, and monitoring
  integrations are design concerns only at this stage.
- No real Meta API, push-notification, tenant authorization, or authenticated Socket.IO behavior was
  exercised because those belong to later milestones.
- pnpm reported that the optional `@scarf/scarf` dependency build script was ignored. Nothing in the
  implemented foundation requires that telemetry-oriented script.

## Files created or modified

Modified: `.gitignore`.

Created:

- Root/tooling: `.editorconfig`, `.env.example`, `.npmrc`, `.prettierignore`, `.prettierrc.json`,
  `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `compose.yaml`, and `scripts/healthcheck.mjs`.
- CI/infrastructure: `.github/workflows/ci.yml` and `infra/docker/README.md`.
- Web: all files under `apps/web`.
- API: all files under `apps/api`, including the model-free Prisma baseline and tests.
- Worker: all files under `apps/worker`.
- Mobile: all files under `apps/mobile`.
- Shared code: all files under `packages/api-client`, `packages/config`, `packages/shared-types`, and
  `packages/validation`.
- Documentation: `docs/local-development.md`, `docs/realtime-foundation.md`, and this report.

## Important commands executed

Discovery and compatibility work used read-only `Get-Content`, `Get-ChildItem`, `rg`, `git status`,
`git log`, `node --version`, `npm --version`, `pnpm --version`, `docker version`, `docker compose
version`, npm metadata queries, and official documentation lookups. Implementation and verification
used:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:validate
pnpm db:connect
pnpm infra:up
pnpm infra:status
pnpm lint
pnpm -r --workspace-concurrency=1 --if-present typecheck
pnpm test
pnpm test:e2e
pnpm shared:build
pnpm --filter @saas/api build
pnpm --filter @saas/worker build
pnpm --filter @saas/web build
pnpm --filter @saas/mobile exec expo export --platform android
pnpm format:check
docker compose ps
git diff --check
```

The API, web, and worker production outputs were also started independently for HTTP/readiness smoke
checks and then stopped. No destructive Docker command, global install, deployment, commit, or push
was performed.

## Acceptance conclusion

All locally applicable Milestone 2 acceptance criteria passed. The two environment-dependent checks
(interactive Android runtime and remote GitHub Actions execution) are clearly unverified, not claimed
as passed. Within the milestone's stated scope, Milestone 2 is complete. Work must stop here until
Milestone 3 is explicitly approved.
