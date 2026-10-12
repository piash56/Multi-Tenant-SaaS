# Milestone 0: Development Environment Verification

Verified on **2026-10-12** on Windows. This document records observations only; no Milestone 1-20 application code or infrastructure was created.

## Outcome

The workstation is ready for **Milestone 1 (Discovery and architecture)**. It is nearly ready for Milestone 2, subject to resolving the PowerShell shim caveat, choosing pinned dependency versions during architecture approval, and deciding whether to update Node before adopting Prisma 8. Docker itself is operational.

## Repository inspection

- Repository root: `F:/Full Stack Practice/Multi Tenant SaaS`
- Git worktree: valid, on branch `main`
- HEAD: `69615c8 chore: initialize SaaS project instructions and roadmap`
- Working tree before this checklist: clean
- Tracked project files before this checklist: `.gitignore`, `AGENTS.md`, and `docs/saas-roadmap.md`
- The complete project inventory contained only `.git`, `docs`, `.gitignore`, and `AGENTS.md`; no application scaffold, package manifest, workspace file, Compose file, source code, dependency directory, or test suite existed.
- `AGENTS.md` and all 20 milestones in `docs/saas-roadmap.md` were read completely before this file was created.
- Git has `core.autocrlf=true`. This is normal for Windows, but shared formatter/editor settings should enforce consistent line endings. `core.longpaths` is not explicitly configured.

## Verified tools

| Component | Actual result | Status / notes |
| --- | --- | --- |
| Windows | Windows 10 Pro, build `26200`, 64-bit | Compatible with the selected stack through native Node and Docker Desktop/WSL2. |
| Node.js | `v22.17.1` | Works. Compatible with Next.js 16, NestJS 12, Prisma 7.10, and React Native 0.87. |
| npm | `10.9.2` through `npm.cmd` | Installed. Bare `npm` is blocked in PowerShell because `npm.ps1` is prohibited by execution policy; this does not affect Git Bash. |
| pnpm | `10.34.7` through `pnpm.cmd` | Installed and appropriate for the workspace. Bare `pnpm` has the same PowerShell execution-policy issue. |
| Corepack | `0.33.0` | Installed. Pin pnpm in the future root `package.json` using `packageManager`. |
| Git | `2.34.0.windows.1` | Works, but is old. An update can be scheduled before CI/security work; it does not block Milestone 1. |
| Git Bash | GNU Bash `4.4.23` at `D:\installation\Git\bin\bash.exe` | Works when invoked explicitly. In PowerShell, the name `bash` resolves to Windows/WSL `bash.exe`, not Git Bash. VS Code should keep using the Git Bash profile. |
| VS Code CLI | `1.140.0`, x64 | Version returned successfully; a sandboxed crash-report registration warning was non-blocking. |
| Docker Engine | client/server `27.2.0`, Linux containers, `x86_64` | Operational using Docker Desktop context `desktop-linux`. |
| Docker Compose | `v2.29.2-desktop.2` | Operational. |
| WSL | WSL `2.2.4.0`, kernel `5.15.153.1`; `docker-desktop` running as WSL 2 | Docker's WSL2 backend is working. No general-purpose development distro was listed. |

Docker Desktop exposes 8 CPUs and about 7.6 GiB RAM to its Linux VM. That is adequate for initial development, but running Next.js, NestJS, Expo/Metro, PostgreSQL, Redis, workers, and tests simultaneously may create memory pressure. Increase Docker Desktop memory if builds or containers are killed or become persistently slow.

## Docker and port safety checks

- `docker run --rm hello-world` completed successfully on 2026-10-12. This created and automatically removed only the isolated smoke-test container.
- Existing container inventory after the test: one stopped container named `postgres`, image `postgres:latest`, state `Exited (0) 2 years ago`.
- The existing `postgres` container was **not started, stopped, deleted, renamed, or modified**.
- Its saved configuration maps host `0.0.0.0:5432` to container `5432/tcp`. Although it is stopped and port 5432 is currently free, starting it would conflict with a future Compose PostgreSQL binding on host port 5432.
- The literal container name `postgres` is already reserved and would conflict with any future `container_name: postgres`.
- No listener was found on the checked ports `3000`, `3001`, `5432`, `6379`, or `8081` at verification time.

For the future Compose file, omit `container_name` so Compose generates project-scoped names. Make host ports configurable, for example `${POSTGRES_PORT:-5433}:5432` and `${REDIS_PORT:-6379}:6379`. Use the service DNS names (`postgres`, `redis`) and their internal ports from containers; do not use host ports for container-to-container traffic. Pin images to explicit versions rather than `latest`.

## Windows and WSL limitations

1. PowerShell script execution policy blocks `npm.ps1` and `pnpm.ps1`. In Git Bash, use `npm`/`pnpm` normally. In PowerShell, use `npm.cmd`/`pnpm.cmd`, or change execution policy manually only if the owner accepts that machine-level policy decision.
2. The managed verification shell initially lacked access to Docker's named pipe and the WSL distro service. Host-authorized checks succeeded, showing this is a session permission boundary rather than a Docker failure.
3. `bash` in PowerShell resolves to `C:\Windows\System32\bash.exe` (WSL), while Git Bash is `D:\installation\Git\bin\bash.exe`. Select **Git Bash** explicitly as the VS Code terminal profile to avoid running commands in the wrong environment.
4. The repository is on an `F:` Windows filesystem. That is suitable for native Git Bash/Node workflows. If development later moves into a Linux WSL distro, clone the repository into that distro's Linux filesystem rather than building repeatedly through `/mnt/f`, which can have slower filesystem watching and different permissions/case behavior.
5. Docker reported that its daemon is not using the default seccomp profile and does not support several blkio throttling features. These Docker Desktop/WSL2 warnings do not block local Milestones 1-2, but production containers must use a hardened Linux deployment configuration later.
6. Windows paths with spaces are valid but require careful quoting in scripts. Package scripts should avoid shell-specific path assumptions.

## Recommended monorepo layout

The final architecture should be approved in Milestone 1. Recommended starting layout for Milestone 2:

```text
apps/
  web/                 # Next.js browser application
  api/                 # NestJS HTTP and Socket.IO API
  worker/              # NestJS standalone BullMQ workers
  mobile/              # Expo / React Native application
packages/
  database/            # Prisma schema, migrations, generated client wrapper
  contracts/           # Shared DTO types and runtime validation schemas
  api-client/          # Typed client shared by web and mobile
  eslint-config/       # Shared lint rules
  typescript-config/   # Shared strict tsconfig bases
infra/
  docker/              # Local infrastructure configuration if needed
docs/
pnpm-workspace.yaml
package.json
pnpm-lock.yaml
compose.yaml
```

Use a private root package, `pnpm-workspace.yaml` with `apps/*` and `packages/*`, and a pinned `packageManager` such as `pnpm@10.34.7`. Keep tenant enforcement and business rules in the backend, not in shared UI packages. Keep Prisma access server-only. Start with pnpm recursive scripts; adopt a task runner only if Milestone 1 identifies a concrete need.

## Compatible dependency baseline

These versions were checked against npm package metadata and official project documentation on 2026-10-12. They are recommendations for Milestone 2, not installed dependencies.

| Component | Recommended pin/baseline | Compatibility decision |
| --- | --- | --- |
| Next.js | `16.4.0` | Requires Node `>=20.9.0`; compatible with Node 22.17.1. Pair with a supported React 19 release selected by the scaffold. |
| NestJS | `12.1.3` for all `@nestjs/*` core packages | Requires Node `>=20`; keep all Nest packages on the same major/minor-compatible line. |
| Prisma CLI and Client | `7.10.0` for both `prisma` and `@prisma/client` | Requires Node `^20.19 || ^22.12 || >=24`, so Node 22.17.1 is compatible. Prisma 7 is ESM-first and requires a PostgreSQL driver adapter. |
| PostgreSQL | `18.6` / image pin based on major `18` plus a locked digest where practical | PostgreSQL 18 is the current supported major. Do not use the existing `postgres:latest` container for this project. |
| Redis Open Source | `8.10.0` / explicitly pinned image | Current documented Redis Open Source line. BullMQ uses Redis features compatible with this baseline; verify the actual image and BullMQ integration in Milestone 2. |
| BullMQ | `6.3.13` | npm metadata requires Node `>=14.17`; compatible with Node 22.17.1 and Redis. |
| Socket.IO | `4.8.4` | npm metadata requires Node `>=10.2`; compatible. Pin matching `socket.io-client` where needed. |
| Expo | SDK/package `57.0.28` | Use Expo's scaffold/install commands during Milestone 2 so Expo selects its exact compatible React and React Native patch versions. |
| React Native | `0.87.1` (Expo-managed) | Requires Node `^22.13 || ^24.3 || >=26`; compatible with Node 22.17.1. Do not independently upgrade it outside Expo's supported matrix. |

Important: npm currently reports `prisma` latest as `8.0.0-rc.22`, which requires Node `>=22.18.0`; the installed Node `22.17.1` does not satisfy that requirement. Use stable Prisma `7.10.0` for the initial baseline, or manually upgrade Node to an approved supported LTS patch before deliberately evaluating stable Prisma 8. Do not use the release candidate for Milestone 2.

Primary references:

- Next.js/NestJS/Prisma/BullMQ/Socket.IO/Expo/React Native version and engine metadata: npm registry queries recorded below.
- Prisma system requirements: <https://docs.prisma.io/docs/orm/reference/system-requirements>
- Prisma 7 changes: <https://docs.prisma.io/docs/orm/v6/more/upgrades/to-v7>
- PostgreSQL supported versions: <https://www.postgresql.org/support/versioning/>
- Redis Open Source release notes: <https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/>

## Software needed by milestone

### Needed now / before Milestones 1-2

- Nothing additional is required to complete Milestone 1, which is documentation and architecture work.
- Before Milestone 2, retain working Node, pnpm, Git, Docker Desktop, and Compose. Decide whether to keep Node 22.17.1 with Prisma 7 or update Node to a supported newer LTS patch before changing the Prisma major.
- Configure VS Code to use Git Bash, or consistently use `.cmd` package-manager shims in PowerShell.
- Ensure Docker Desktop starts and remains in Linux-container mode.
- A code formatter/linter, test frameworks, Prisma CLI, framework CLIs, and all application tooling should be added as **workspace devDependencies**, not globally installed.
- Optional but useful: install/update the VS Code ESLint, Prettier, Prisma, and Docker extensions manually. Extensions are conveniences, not build requirements.

### Can wait until later milestones

- Android Studio, Android SDK, emulator images, JDK requirements, Expo development builds, and physical Android device configuration can wait until the mobile implementation/build milestones (14-17). Expo scaffolding in Milestone 2 does not require a full Android emulator setup.
- Meta developer/business accounts, eligible Facebook Pages, Instagram professional accounts, WhatsApp Business assets, access tokens, webhook domains, permissions, and app review can wait until the platform integration milestones (11-13). Use mocks before then.
- Public HTTPS tunneling for webhook development can wait until channel integration work.
- Cloud hosting, production PostgreSQL/Redis, object storage, domains/TLS, monitoring, backup tooling, CI runners, signing keys, EAS account/credentials, and Play Console access can wait for their relevant deployment/mobile milestones.
- Security scanners, SBOM tooling, and production observability should be planned earlier but need not be installed globally now; integrate pinned CI/project tools in the appropriate milestones.

## Commands that work now

Run from Git Bash unless noted:

```bash
node --version
npm --version
pnpm --version
git status --short --branch
docker info
docker compose version
docker run --rm hello-world
```

In PowerShell on this machine, use `npm.cmd` and `pnpm.cmd` instead of the bare names.

## Planned monorepo commands (do not work yet)

The following scripts are a recommended contract for Milestone 2. They are **planned only** because no `package.json`, workspace, applications, dependencies, services, or Compose file exists yet:

```bash
pnpm install --frozen-lockfile
pnpm dev                 # run web, API, worker, and mobile dev tasks as documented
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm dev:mobile
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm infra:up            # PostgreSQL/Redis only, via future Compose file
pnpm infra:down
pnpm healthcheck
```

Milestone 2 should make the individual app commands work independently and define precisely whether `pnpm dev` includes the mobile Metro server. Database migrations must be explicit and must not run silently during every app start.

## Manual next steps for a beginner

1. Keep the old `postgres` container stopped. Do not reuse or remove it until its data ownership is understood.
2. In VS Code, open **Terminal > Select Default Profile**, choose **Git Bash**, and open a new terminal.
3. In that terminal, run `node --version`, `pnpm --version`, `docker info`, and `git status --short --branch`. Confirm they return versions/daemon details and branch `main` without errors.
4. Do not run any planned `pnpm dev`, database, or Compose commands yet; there is no application scaffold.
5. Review and approve the architecture and version baseline during Milestone 1. Only after Milestone 1 is accepted should Milestone 2 create the workspace.

## Exact verification commands and results

Commands were executed from the repository root. Semicolon-separated commands were independent read-only checks unless noted.

| Command | Result |
| --- | --- |
| `Get-Content -Raw -LiteralPath 'AGENTS.md'; Get-Content -Raw -LiteralPath 'docs/saas-roadmap.md'` | Both files read completely; roadmap contains Milestones 1-20. |
| `Get-ChildItem -Force; rg --files -uu` | Complete inventory collected, including Git metadata; only three tracked project files existed. |
| `git rev-parse --is-inside-work-tree; git rev-parse --show-toplevel; git status --short --branch; git log -1 --oneline --decorate` | Valid worktree at expected root; clean `main`; HEAD `69615c8`. |
| `node --version; npm --version; pnpm --version; git --version; docker --version; docker compose version` | Node/Git/Docker/Compose returned expected versions; bare npm/pnpm failed under PowerShell execution policy. |
| `npm.cmd --version; pnpm.cmd --version; where.exe node; where.exe npm; where.exe pnpm; where.exe git; where.exe docker` | npm `10.9.2` and pnpm `10.34.7` verified; executable paths identified. |
| `wsl --status; wsl --version; wsl --list --verbose` | Initial managed-shell access denied; authorized host check showed WSL2 and running `docker-desktop`. |
| `docker info; docker ps --all ...; docker context show; docker system df` | Initial managed-shell pipe access denied; authorized host check verified daemon, context, resources, and the one stopped container. |
| `docker run --rm hello-world` | Passed; daemon pulled/ran the image and automatically removed the test container. |
| `docker inspect postgres --format ...` | Read-only inspection confirmed stopped state, `postgres:latest`, reserved name, and saved host port 5432 binding. |
| `Get-NetTCPConnection ...` for ports `3000,3001,5432,6379,8081` | No listening connection returned for those ports. |
| `Get-ComputerInfo ...` | Windows 10 Pro, build 26200, 64-bit. |
| `git config --show-origin --get core.autocrlf; git config --show-origin --get core.longpaths` | `core.autocrlf=true`; no explicit `core.longpaths` value returned. |
| `Get-Content -Raw -LiteralPath '.gitignore'; bash --version; corepack --version; code --version; git ls-files; git status --porcelain=v1` | Ignore rules reviewed; unqualified `bash` hit WSL permission boundary; Corepack/VS Code verified; tracked files and clean status confirmed. |
| `where.exe bash; & 'D:\installation\Git\bin\bash.exe' --version; Get-Command bash ...` | Git Bash 4.4.23 works explicitly; PowerShell resolves `bash` to WSL's executable. |
| `npm.cmd view ... --json` package metadata queries | Read-only registry checks established the versions and Node/peer constraints in the compatibility table; nothing was installed. |

## Acceptance and readiness

- Project directory inspected: **pass**
- Git repository and initial worktree verified: **pass**
- Required tool versions verified: **pass with PowerShell shim caveat**
- WSL/Docker compatibility checked: **pass with documented limitations**
- Docker container execution verified without modifying the stopped database container: **pass**
- PostgreSQL name/port risks identified: **pass**
- Workspace structure and version baseline recommended: **pass**
- Immediate and deferred tooling documented: **pass**
- Application tests: **not applicable**; no application or tests exist in Milestone 0

**Ready for Milestone 1: yes.** Do not begin it until the owner reviews this checklist and explicitly confirms continuation.
