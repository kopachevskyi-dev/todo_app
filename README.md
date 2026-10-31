# Day Planner

A personal day planner. This first version provides an empty Plan / History shell,
a PostgreSQL baseline, daily backups, and the tools for later features. No tasks
are created yet. The theme follows your system setting.

## Start and stop

Install Docker Desktop (or Docker Engine with Compose on Linux), then:

```sh
cp .env.example .env
docker compose up -d
```

Open http://localhost:3000. The API server serves the built React client at the
same URL. Readiness is at http://localhost:3000/api/health.

```sh
docker compose down
```

There is no restart policy or autostart. Starting again keeps your data.

## Data and timezone

The default `DATA_DIR=~/Desktop/todo-app-data` is **temporary, to be changed**.
PostgreSQL is stored in `DATA_DIR/db`; daily dumps are stored in `DATA_DIR/backups`.
Both folders are outside the repository. Set an
absolute path (or a leading `~/`) in `.env` to choose a different location.

To move existing data: stop the app, copy the whole data directory to the new
location, and change only `DATA_DIR` in `.env` before starting again. Changing the
path without copying starts a new empty database; the old folder remains intact.
`APP_PORT` changes the user instance port. Empty `TZ` uses the host timezone via
its read-only `/etc/localtime` mount; an IANA name such as `Europe/Warsaw` overrides
it. Health reports the effective timezone and current timestamp.

Migrations are forward-only SQL files in `apps/api/migrations`, ordered by their
numbered filenames. They run transactionally before the server listens, with a
PostgreSQL advisory lock and an applied-version ledger. Add a new numbered file
for schema changes; never edit an applied migration.

## Backups and manual restore

After migrations on each server start, the app creates `YYYY-MM-DD.dump` in
`DATA_DIR/backups` if that date has no backup yet. Dates use the configured
timezone. Restarting on the same day preserves the existing file; only the three
newest dated backups are kept. These are PostgreSQL custom-format dumps. A failed
backup is logged (`docker compose logs app`) and the app still starts; the next
start retries. Restart the app on a later date to create another backup; there
is no background backup timer. Keep separate copies if you need longer history.

To restore, replace the example path below with the absolute path to your dump.
This replaces the current database contents with the selected backup. Run
`docker compose down` and copy your data folder first to preserve the current state.

```sh
docker compose stop app
docker compose up -d db --wait
docker compose exec -T db dropdb -U planner --force planner
docker compose exec -T db createdb -U planner planner
docker compose exec -T db pg_restore -U planner -d planner \
  --no-owner --no-privileges --exit-on-error --single-transaction \
  < /absolute/path/to/backups/2026-11-01.dump
docker compose up -d app
```

The database client runs inside Docker; no local PostgreSQL installation is
needed. Starting the app afterwards applies any newer migrations automatically.

## Development and tests

Use Node.js 24 and Docker. From the repository root:

```sh
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run build
npm test
npm run smoke
```

`npm ci` installs the pre-commit hook when Git metadata is writable. In a sandbox
with read-only Git metadata, run `git config core.hooksPath .githooks` in the main
checkout after merging. The hook runs lint, typecheck, and tests related
to staged files. API changes run API tests; browser changes run E2E; shared build
or tooling changes run both. Docker must be running for tests and commits that
change app code. CI runs all checks and smoke on pull requests and pushes to main.

For a single test file:

```sh
npx tsx --test apps/api/test/health.test.ts
npx playwright test tests/e2e/shell.spec.ts
```

API tests start a real disposable PostgreSQL container on a dynamically assigned
localhost port, apply migrations, and expose the app on a random HTTP port. The
harness injects a controllable clock; assertions use HTTP responses. Containers
are removed afterwards. Tests never use the user's database or data directory.

The E2E command starts and removes a separate Compose project (`todo-app-test`)
on port 3100, with PostgreSQL stored in tmpfs. To run that instance manually:

```sh
docker compose -f compose.test.yaml up -d --build --wait
# Open http://localhost:3100
docker compose -f compose.test.yaml down -v
```

This is a standalone Compose file; do not merge it with the user configuration.
It can run beside the user instance and has no user data mounts or published
PostgreSQL port. Override `TEST_APP_PORT` for manual instances if needed. E2E
reserves port 3100 and refuses to reuse an existing server, so stop any manually
started dev instance before running it.

Smoke uses the user Compose configuration under a unique project name, random
port, and new temporary data folder. It checks first startup, health, UI delivery,
and persistence across full container recreation, then removes its own data.
It also checks that migration timestamps do not change on restart. Smoke creates and edits a Task through the HTTP API and checks it after restart. It then checks that a valid daily backup exists.

If a sandbox prevents local Chromium from launching, Playwright can use a remote
browser (matching the version in package-lock.json):

```sh
docker run -d --rm --name todo-browser -p 127.0.0.1:3200:3200 \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  npx -y playwright@1.64.1 run-server --port 3200 --host 0.0.0.0
PLAYWRIGHT_WS_ENDPOINT=ws://127.0.0.1:3200/ \
  E2E_BASE_URL=http://host.docker.internal:3100 npm run test:e2e
docker stop todo-browser
```

On Docker Desktop the remote browser reaches the app using `host.docker.internal`.
When a sandbox restricts Docker's build cache, set `BUILDX_CONFIG` to a writable
temporary directory when running Compose, E2E, or smoke.
