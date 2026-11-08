# Todo app

A personal todo app. Designs live in `docs/design/`: desktop and mobile mockups (`.dc.html`, open in the design canvas) and `design-language.md`, the source of truth for the UI.

## Agent skills

- Issue tracker: GitHub Issues of `kopachevskyi-dev/todo_app`, via `gh`. See `docs/agents/issue-tracker.md`.
- Install: none yet
- Test levels: none yet
- Missing test levels: unit, integration, contract, e2e, smoke (the repo is empty; the first ticket of the next spec is a skeleton that adds the stack, the commands below, `orca.yaml`, the pre-commit hook and CI)
- Test all: none yet
- Typecheck: none yet · Lint: none yet
- Smoke: none yet
- Verify: none yet · Verify fast: none yet
- Parallel work: tests and smoke share no port, data folder or container names between worktrees. Name migrations and other ordered files by timestamp, not by sequence number.
- Gates: pre-commit runs lint and typecheck; CI runs `Verify`. Never bypass them (`--no-verify`, disabling a check).
- Domain docs: `GLOSSARY.md` and `docs/adr/` at the root, if present. Use their vocabulary and flag conflicts with an ADR instead of silently overriding it. If they don't exist, proceed without them.
