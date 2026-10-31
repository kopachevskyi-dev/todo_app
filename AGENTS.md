## Agent skills

- Issue tracker: GitHub Issues of kopachevskyi-dev/todo_app. See `docs/agents/issue-tracker.md`.
- Install: `none yet` (run by Orca's worktree setup)
- Test all: `none yet` · Test one file: `none yet`
- Typecheck: `none yet` · Lint: `none yet`
- Smoke: `none yet`
- Gates: pre-commit runs fast checks (lint, typecheck, related tests); CI runs everything above. Never bypass them (`--no-verify`, disabling a check). Not set up yet: the first ticket of the next spec adds them.
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.
