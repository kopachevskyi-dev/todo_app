## Agent skills

- Issue tracker: GitHub Issues of kopachevskyi-dev/todo_app. See `docs/agents/issue-tracker.md`.
- Install: `npm ci` (Node 24; Docker required for tests; `npx playwright install chromium` once)
- Test all: `npm test` · Test one file: `npx tsx --test apps/api/test/<file>.test.ts` or `npx playwright test tests/e2e/<file>.spec.ts`
- Typecheck: `npm run typecheck` · Lint: `npm run lint`
- Smoke: `npm run smoke`
- Gates: pre-commit runs fast checks (lint, typecheck, related tests); CI runs everything above. Never bypass them (`--no-verify`, disabling a check). Hook installed by `npm ci`; related tests select API/E2E by staged paths. Docker must be running.
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.
