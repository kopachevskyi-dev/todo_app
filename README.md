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

`pnpm verify:fast` runs lint, typecheck, unit, integration, contract, and build.
`pnpm verify` adds Chromium e2e tests and the production server smoke check.
See `AGENTS.md` for individual commands, sandbox verification, hook setup,
and the workspace-local pnpm bootstrap when Corepack is not enabled globally.
