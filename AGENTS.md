# Todo app

A personal todo app. Designs live in `docs/design/`: desktop and mobile mockups (`.dc.html`, open in the design canvas) and `design-language.md`, the source of truth for the UI.

## Agent skills

- Issue tracker: GitHub Issues of `kopachevskyi-dev/todo_app`, via `gh`. See `docs/agents/issue-tracker.md`.
- Runtime: Node 24 (`nvm use`), pnpm 12.18.0 (pinned in `package.json`; enable Corepack).
- Install: `pnpm install --frozen-lockfile`; browser setup: `pnpm browsers:install` (Linux CI: `pnpm browsers:install --with-deps`). Browsers are installed inside `node_modules`, not a shared machine cache.
- Dev: `pnpm dev` (Vite proxies `/api` to the Hono server).
- Build: `pnpm build` · Start: `pnpm start` (one process serves API and built client).
- Test levels: unit (pure domain functions and isolated helpers), integration (in-process HTTP with real temporary SQLite files), contract (shared Zod schemas and payloads), e2e (Chromium), smoke (built server).
- Missing test levels: none
- Unit: `pnpm test:unit`; one file: `pnpm test:unit tests/unit/time.test.ts`.
- Integration: `pnpm test:integration`; one file: `pnpm test:integration tests/integration/api.test.ts`.
- Contract: `pnpm test:contract`; one file: `pnpm test:contract tests/contract/responses.test.ts`.
- E2e: `pnpm test:e2e`; one file: `pnpm test:e2e tests/e2e/today.spec.ts` (builds first).
- Test all: `pnpm test` (unit, integration, contract, e2e; smoke is separate).
- Typecheck: `pnpm typecheck` · Lint: `pnpm lint` · Format: `pnpm format`.
- Smoke: `pnpm smoke` (builds, starts a real server with a free port and a fresh temporary database, checks health and the served Today heading, stops).
- Smoke startup-failure check: after building, `node scripts/smoke.mjs dist/missing-server.js` must exit nonzero.
- Verify: `pnpm verify` (lint, typecheck, all tests, build, smoke; fails fast).
- Verify fast: `pnpm verify:fast` (lint, typecheck, unit, integration, contract, build; excludes e2e and smoke).
- Parallel work: tests and smoke share no port, data folder or container names between worktrees. Name migrations and other ordered files by timestamp, not by sequence number.
- Gates: pre-commit runs lint and typecheck; CI runs `Verify`. Never bypass them (`--no-verify`, disabling a check).
- Hook setup: `git config core.hooksPath .githooks` once per repository; install runs this automatically and leaves an already configured repository alone.
- Sandbox check: `codex sandbox -P :workspace --log-denials -C "$PWD" -- pnpm verify:fast`.
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.

## Foundation conventions

- Code lives in `src/domain`, `src/persistence`, `src/api`, `src/shared`, and `src/web`. Shared Zod schemas define API payloads for both the server and client.
- Environment variables are documented in `.env.example`. `PORT=0` lets the OS choose a port; the server prints a JSON `listening` event with that port. Production defaults to loopback; set `HOST` explicitly for a container.
- Every `/api` request, including health checks and unknown routes, requires a valid IANA `X-Timezone`. The web API module supplies the browser's zone.
- Only `systemClock` reads the actual clock. Inject `Clock` into the server; pass `now` and a time zone to domain functions, and `now` to `createId` when generating ULIDs. The optional test clock is enabled only by `ENABLE_TEST_CLOCK=true`; PUT and GET `/api/test/clock` set/read it, and both routes are absent otherwise.
- SQL migrations in `migrations/` run on startup through Drizzle. Name new migration files by timestamp and register them in `migrations/meta/_journal.json`. The initial migration seeds stable ULIDs and UTC creation instants exactly once; later server-generated IDs use `createId`.
- Instants are UTC ISO strings; local dates are `YYYY-MM-DD`. SQLite foreign keys are enabled on every connection. Repositories expose a transaction boundary.
- Unit/contract/integration levels accept a file path after their command. Each integration/contract fixture uses Hono's in-process `app.request` against its own migrated temporary SQLite file, requiring no TCP listener. E2e and smoke start the production entry point on an OS-assigned free port with a temporary database and clean up afterwards.
- On a machine without pnpm, a workspace-local bootstrap can use `COREPACK_HOME="$PWD/.corepack" corepack enable --install-directory .local-bin` after `mkdir -p .local-bin`, then export `COREPACK_HOME="$PWD/.corepack"` and prepend `$PWD/.local-bin` to `PATH`. These bootstrap/cache directories are ignored.
