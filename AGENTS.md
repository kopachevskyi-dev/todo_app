## Agent skills

- Issue tracker: GitHub Issues of kopachevskyi-dev/todo_app. See `docs/agents/issue-tracker.md`.
- Install: `npm ci` (run by Orca's worktree setup; Node 24; Docker required for tests; `npx playwright install chromium` once)
- Test all: `npm test` · Test one file: `npx tsx --test apps/api/test/<file>.test.ts` or `npx playwright test tests/e2e/<file>.spec.ts`
- Typecheck: `npm run typecheck` · Lint: `npm run lint`
- Smoke: `npm run smoke`
- Verify: `npm run verify` (everything above) · Verify fast: `npm run verify:fast` (lint, typecheck, API tests; no E2E, no smoke)
- Parallel work: tests and smoke share no port, data folder or container names between worktrees (E2E derives its port and Compose project from the folder name). Name migrations and other ordered files by timestamp, not by sequence number.
- Gates: pre-commit runs fast checks (lint, typecheck, related tests); CI runs everything above. Never bypass them (`--no-verify`, disabling a check). Hook installed by `npm ci`; related tests select API/E2E by staged paths. Docker must be running.
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.

## Design

- Any change to the web UI (`apps/web`) follows `docs/design/design-language.md` (reference image: `docs/design/inspiration.jpg`). Reviews treat a violation of it as a standards finding.
