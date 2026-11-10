# Todo app

Requires Node 24 and pnpm 12.18.0 (see `.nvmrc` and `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm browsers:install
pnpm dev
```

Vite prints the development URL and proxies `/api` to Hono on port 3000.
Copy `.env.example` to `.env` to change ports or the database path.

```sh
pnpm build
pnpm start
```

The built server serves the Today page and JSON API in one process. SQLite
migrations run automatically on startup. Every API request needs an IANA
`X-Timezone` header, including `GET /api/health` and `GET /api/lists`.

Docker with Compose v2 runs the production app and the full verification gate.
To start the app with an OS-assigned port bound to loopback:

```sh
docker compose -f compose.yaml -f compose.ports.yaml up --build -d app
docker compose -f compose.yaml -f compose.ports.yaml port app 3000
```

Open `http://127.0.0.1:<printed-port>/today`. Plain `docker compose up --build app`
starts the same app without publishing a host port. The runtime uses Node 24,
production dependencies, a non-root user and `HOST=0.0.0.0`; its health check
sends `X-Timezone: UTC`. `docker compose ps` shows the health status.
`docker compose down` stops the app and retains its SQLite data in the project's
named volume; start it again with the same command to keep your tasks.
`docker compose down --volumes` also deletes that data.

Container checks require only Docker and Compose on the host:

```sh
sh scripts/containers.sh verify
sh scripts/containers.sh e2e
sh scripts/containers.sh e2e tests/e2e/today.spec.ts
sh scripts/containers.sh smoke
# Must exit nonzero; checks cleanup after a failed runtime startup too.
sh scripts/containers.sh smoke dist/missing-server.js
```

The equivalent pnpm shortcuts are `verify:container`, `test:e2e:container` and
`smoke:container`. The scripts build their images and use `docker compose run
--rm` to remove each check container. Verification runs `pnpm verify` inside the
image: lint, typecheck, unit, integration, contract, e2e and runtime-image smoke.
The Docker build compiles the app once; e2e and smoke reuse that output.
Smoke creates a runtime container with a free loopback host port and fresh tmpfs
database, checks health and the Today heading from inside it, and removes it
even when startup or a probe fails. Verify and smoke mount `/var/run/docker.sock`
to create that sibling container; run these services only with trusted source.
The app and standalone e2e service need no Docker socket.

Compose's default project name comes from the worktree folder. Use different
folder names for simultaneous worktrees: each gets separate images, networks
and a named database volume, while all test databases and ports are disposable.
Avoid a shared `COMPOSE_PROJECT_NAME` override. CI builds the same runtime and
verify targets with BuildKit layer caching and runs the same container gate;
it installs neither Node nor Chromium on the host.

Containers get Chromium from the official Playwright image, without
`browsers:install`. When upgrading `@playwright/test`, update its pinned version
and lockfile together with `mcr.microsoft.com/playwright:v<version>-noble` in
`Dockerfile`. Keep the Dockerfile's Node images in sync with `.nvmrc` as well.
The image layout follows the [Playwright Docker guide](https://playwright.dev/docs/docker)
and [pnpm Docker guide](https://pnpm.io/docker); CI caching follows
[Docker's GitHub Actions guide](https://docs.docker.com/build/ci/github-actions/cache/).

Host development and the pre-commit hook stay on the host. `pnpm verify:fast`
runs lint, typecheck, unit, integration, contract, and build without Docker.
`pnpm verify` adds host Chromium e2e and host smoke, sharing one build between
them. `pnpm test:e2e <file>` and `pnpm smoke` still build first when run separately;
unit, integration and contract still accept a test file. See `AGENTS.md` for
individual commands, sandbox verification, hook setup, and the workspace-local
pnpm bootstrap when Corepack is not enabled globally.
