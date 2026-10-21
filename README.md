# Agentic workflow

You describe a task. Claude asks questions and writes a plan. Grok writes the code. A second Claude reviews the result. You decide what happens next.

Nothing is written until you approve the plan. Nothing is pushed unless you ask.

## Who does what

- **Claude** (Claude Code) thinks: asks, plans, runs the checks, reports. It does not write the product code.
- **Sonnet** (a short subagent, medium effort) writes the tests of a batch from the plan. The tests are the definition of done.
- **Grok 4.7** (Cursor's `agent` command) writes the code. It never edits the tests.
- **The reviewer** is a separate Claude with a clean memory. It reads only the plan, the diff and the check results.

## Commands

| Command | What it does |
| --- | --- |
| `/ask-it` | Questions in rounds, each with a suggested answer, until nothing is open |
| `/plan-it <name>` | Writes `.scratch/<name>/plan.md`: goal, decisions, slices, batches. Stops for your approval |
| `/code-it <name>` | Per batch: tests, code, check, commit. Then final checks and the diff |
| `/review-it <name>` | Independent report: matches plan, bugs, not verified, gaps, verdict |

Start a fresh Claude session for each task.

## What lives where

| In this repo | Goes to |
| --- | --- |
| `skills/` | `~/.claude/skills/` (the same `SKILL.md` format also works in `~/.cursor/skills/`) |
| `claude/CLAUDE.md` | `~/.claude/CLAUDE.md` |
| `claude/settings.permissions.json` | the `permissions` block of `~/.claude/settings.json` |

Cursor has no global config of its own yet. Grok gets its rules from the prompt that `/code-it` builds. When a Cursor-only setting appears, put it in a `cursor/` folder.

Project-specific facts (check commands under `## Checks`, code map, test notes) belong in that project's own `CLAUDE.md`, not here.

## Rules built into the skills

- A batch is one piece of functionality you can run and see. The first batch is the thinnest version that works end to end; each next one adds a piece. A batch fits in about 15 minutes of Grok time, and every Grok run is limited to 25 minutes.
- Tests are written by Sonnet and locked with `git add` before Grok starts. Grok runs on `grok-4.7-medium`.
- One commit per green batch: a short title and 2-5 plain bullets. Claude picks the files. Never push.
- After each batch Claude stops, says in a line or two what to look at, and waits for your go-ahead.

## Sources

The skills started from [mattpocock/skills](https://github.com/mattpocock/skills) (`grilling`, `to-spec`, `tdd`) and were adapted. Each skill keeps a comment with the source version it came from.
