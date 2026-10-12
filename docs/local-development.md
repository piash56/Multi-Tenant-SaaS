# Local development

## Prerequisites

- Windows with Docker Desktop in Linux-container mode.
- Node.js 22.17.1 and pnpm 10.34.7.
- Git Bash as the recommended VS Code terminal. In PowerShell use `pnpm.cmd` instead of `pnpm`.
- Ports 3000, 3001, 5433, 6379, and 8081 available, or override the documented ports.

The older stopped Docker container named `postgres` is unrelated. Do not start, remove, or modify
it. This project uses Compose-generated names and PostgreSQL host port 5433.

## Install and configure

From the repository root in Git Bash:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
pnpm db:generate
```

All example passwords are local-only. Choose managed secrets and strong unique credentials for any
non-local environment. Variables prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are bundled into clients
and must never contain secrets.

The repository uses pnpm's hoisted linker because the isolated linker consumed excessive memory
while reconstructing this Expo-heavy workspace on the verified Windows machine. Dependency pins
and the frozen lockfile remain authoritative; packages must still declare every direct dependency.

## Start and stop infrastructure

```bash
pnpm infra:up
pnpm infra:status
pnpm infra:down
```

`infra:down` stops/removes only this Compose project's containers and network; named database and
Redis volumes remain. Do not add `-v` unless deletion has been explicitly approved.

Local services:

| Service    | Host URL/port                | Container-to-container address  |
| ---------- | ---------------------------- | ------------------------------- |
| PostgreSQL | `localhost:5433`             | `postgres:5432`                 |
| Redis      | `localhost:6379`             | `redis:6379`                    |
| API        | `http://localhost:3001`      | Deployment-specific             |
| Swagger    | `http://localhost:3001/docs` | Deployment-specific             |
| Web        | `http://localhost:3000`      | Browser uses the public API URL |

The database and Redis ports bind to Windows loopback, not every network interface.

## Start applications independently

Use separate Git Bash terminals:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
pnpm dev:mobile
```

`pnpm dev` starts web, API, and worker together; it deliberately excludes Expo so Metro remains an
explicit choice. Check the API with `pnpm healthcheck` or browse `/health/live` and `/health/ready`.
Liveness reports the process only. Readiness also checks PostgreSQL and Redis.

## Mobile networking

- Android Studio emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
- Genymotion commonly uses `10.0.3.2`; verify its documentation.
- Physical device: use `http://<Windows-LAN-IP>:3001`, keep device/computer on the same trusted
  network, and allow the API port through Windows Firewall only for the private network if needed.
- `localhost` on an emulator/device refers to that emulator/device, not the Windows computer.

Run `pnpm dev:mobile`, then use Expo's displayed controls/QR code. Android Studio, an emulator, and
a physical device are not installed automatically. A physical Expo connection may require LAN or
tunnel configuration; do not expose a development API to an untrusted network.

## Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
pnpm db:validate
pnpm db:connect
```

## Troubleshooting

- **PowerShell blocks pnpm.ps1:** use Git Bash or `pnpm.cmd`.
- **Port 5432 conflict/old container:** this project defaults to 5433; never reuse the old container.
- **Readiness is 503:** run `pnpm infra:status`, inspect `docker compose logs postgres redis`, and
  compare API URLs/credentials with the examples.
- **Mobile cannot reach API:** use `10.0.2.2` for the Android emulator or the Windows LAN IP for a
  physical device; ensure the API is listening and private-network firewall access is deliberate.
- **Prisma client missing:** set `DATABASE_URL` and run `pnpm db:generate`. Milestone 2 creates no
  business models and no migrations.
- **Docker memory pressure:** stop unused workloads or increase Docker Desktop memory; do not run
  global Docker cleanup commands.

## Known limitations and Milestone 3 prerequisites

There is no authentication, tenant schema, business API, realtime room authorization, live social
adapter, or production job. The Socket.IO namespace is lifecycle-only. The worker has an empty
foundation queue. Expo device/emulator behavior requires local Android tooling or a physical device
and is not proven by TypeScript/Metro export alone.

Before Milestone 3, approve the fixed-role/custom-role decision, review the database design, keep
the local services healthy, and create the first explicit Prisma migration only as part of that
milestone.
