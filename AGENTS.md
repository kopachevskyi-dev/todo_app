# Todo app

A personal todo app. Designs live in `docs/design/`: desktop and mobile mockups (`.dc.html`, open in the design canvas) and `design-language.md`, the source of truth for the UI.

## Agent skills

- Issue tracker: GitHub Issues of `kopachevskyi-dev/todo_app`, via `gh`. See `docs/agents/issue-tracker.md`.
- Runtime: Node 24 (`nvm use`), pnpm 12.18.0 (pinned in `package.json`; enable Corepack).
- Install on host: `pnpm install --frozen-lockfile`; browser setup: `pnpm browsers:install` (Linux host: `pnpm browsers:install --with-deps`). Host browsers are installed inside `node_modules`; containers use the official Playwright image's browsers without running `browsers:install`.
- Dev: `pnpm dev` (Vite proxies `/api` to the Hono server).
- Build: `pnpm build` · Start: `pnpm start` (one process serves API and built client).
- Run app in Docker: `docker compose -f compose.yaml -f compose.ports.yaml up --build -d app`; find its free loopback port with `docker compose -f compose.yaml -f compose.ports.yaml port app 3000`. Plain `docker compose up --build app` publishes no host port. `docker compose down` preserves the app database volume; `down --volumes` deletes it.
- Test levels: unit (pure domain functions and isolated helpers), integration (in-process HTTP with real temporary SQLite files), contract (shared Zod schemas and payloads), e2e (Chromium), smoke (built server).
- Missing test levels: none
- Unit: `pnpm test:unit`; one file: `pnpm test:unit tests/unit/time.test.ts`.
- Integration: `pnpm test:integration`; one file: `pnpm test:integration tests/integration/api.test.ts`.
- Contract: `pnpm test:contract`; one file: `pnpm test:contract tests/contract/responses.test.ts`.
- E2e on host: `pnpm test:e2e`; one file: `pnpm test:e2e tests/e2e/today.spec.ts` (builds first, uses host Chromium). In Docker: `sh scripts/containers.sh e2e [tests/e2e/today.spec.ts]` (omit brackets; optional file). Keep `@playwright/test` and the Playwright Dockerfile image version equal when upgrading (currently 1.65.0).
- Test all: `pnpm test` (unit, integration, contract, e2e; smoke is separate).
- Typecheck: `pnpm typecheck` · Lint: `pnpm lint` · Format: `pnpm format`.
- Smoke in Docker: `sh scripts/containers.sh smoke` (builds the runtime image, starts it with a free loopback host port and fresh tmpfs database, checks health and `/today` inside the runtime container, removes it). Host smoke stays `pnpm smoke` (builds, starts the host server on a free port and temporary database, checks health and Today, stops).
- Smoke startup-failure check: `sh scripts/containers.sh smoke dist/missing-server.js` must exit nonzero. Host equivalent after building: `node scripts/smoke.mjs dist/missing-server.js`.
- Verify in Docker: `sh scripts/containers.sh verify` (or `pnpm verify:container`); builds runtime and verify images, then runs full `pnpm verify` inside. Build output is shared by e2e and runtime smoke. CI uses the same images and command with BuildKit layer caching, without a host Node/Chromium install. Verify and smoke services mount the Docker socket to manage the disposable runtime smoke container.
- Verify on host: `pnpm verify` (lint, typecheck, unit, integration, contract, one build, e2e, host smoke; fails fast). `test:e2e:built` and `smoke:built` reuse an existing build; the container's `APP_PREBUILT=true` reuses its Docker build stage.
- Verify fast: `pnpm verify:fast` (lint, typecheck, unit, integration, contract, build; excludes e2e and smoke).
- Parallel work: Compose derives the project name from the worktree folder; use distinct folder names and do not override `COMPOSE_PROJECT_NAME` with a shared name. Images, networks, and the named app volume belong to that project. Tests and smoke share no fixed host port, data folder or container name between worktrees; smoke uses a Docker-generated container name and disposable tmpfs database. Name migrations and other ordered files by timestamp, not by sequence number.
- Gates: pre-commit runs lint and typecheck; CI runs `Verify`. Never bypass them (`--no-verify`, disabling a check).
- Hook setup: `git config core.hooksPath .githooks` once per repository; install runs this automatically and leaves an already configured repository alone.
- Sandbox check: `codex sandbox -P :workspace --log-denials -C "$PWD" -- pnpm verify:fast`.
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.

## Foundation conventions

- Code lives in `src/domain`, `src/persistence`, `src/api`, `src/shared`, and `src/web`. Shared Zod schemas define API payloads for both the server and client.
- Environment variables are documented in `.env.example`. `PORT=0` lets the OS choose a port; the server prints a JSON `listening` event with that port. Production defaults to loopback; set `HOST` explicitly for a container.
- Every `/api` request, including health checks and unknown routes, requires a valid IANA `X-Timezone`. The web API module supplies the browser's zone.
- Only `systemClock` reads the actual clock. Inject `Clock` into the server; pass `now` and a time zone to domain functions, and `now` to `createId` when generating ULIDs. The optional test clock is enabled only by `ENABLE_TEST_CLOCK=true`; PUT and GET `/api/test/clock` set/read it, and both routes are absent otherwise. GET `/api/clock` also reads the clock and is registered only when the test clock is enabled.
- SQL migrations in `migrations/` run on startup through Drizzle. Name new migration files by timestamp and register them in `migrations/meta/_journal.json`. The initial migration seeds stable ULIDs and UTC creation instants exactly once; later server-generated IDs use `createId`.
- Instants are UTC ISO strings; local dates are `YYYY-MM-DD`. SQLite foreign keys are enabled on every connection. Repositories expose a transaction boundary.
- Unit/contract/integration levels accept a file path after their command. Each integration/contract fixture uses Hono's in-process `app.request` against its own migrated temporary SQLite file, requiring no TCP listener. E2e and smoke start the production entry point on an OS-assigned free port with a temporary database and clean up afterwards.
- On a machine without pnpm, a workspace-local bootstrap can use `COREPACK_HOME="$PWD/.corepack" corepack enable --install-directory .local-bin` after `mkdir -p .local-bin`, then export `COREPACK_HOME="$PWD/.corepack"` and prepend `$PWD/.local-bin` to `PATH`. These bootstrap/cache directories are ignored.
