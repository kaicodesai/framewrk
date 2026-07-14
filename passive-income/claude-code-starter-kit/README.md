# Agent Ops Starter Kit for Claude Code

A drop-in pack of skills, subagents, hooks, and a starter `settings.json` for developers using
Claude Code — covering the workflow gaps that aren't covered out of the box: dependency
upgrade planning, license compliance, test-gap detection, doc-drift checking, release
orchestration, and safety-net hooks for destructive commands.

Not affiliated with or endorsed by Anthropic. "Claude Code" refers to Anthropic's CLI agent
tool, which this pack extends via its public skills/subagents/hooks configuration surface.

## What's included

### Skills (`skills/`)
Drop each folder into your project's `.claude/skills/` (or your user-level `~/.claude/skills/`)
directory.

| Skill | What it does |
|---|---|
| `changelog-from-commits` | Generates a Keep-a-Changelog-style entry from git history since the last tag |
| `conventional-commit-lint` | Checks/rewrites commit messages against the Conventional Commits spec |
| `dependency-upgrade-planner` | Audits outdated/vulnerable dependencies and produces a phased, risk-ranked upgrade plan |
| `test-gap-finder` | Finds untested exports and scaffolds honest test stubs (no fake passing assertions) |
| `onboarding-doc-generator` | Builds/refreshes a CONTRIBUTING.md grounded in the repo's real setup and scripts |
| `license-compliance-scan` | Flags copyleft/unlicensed dependencies against your project's own license model |

### Subagents (`agents/`)
Drop each file into your project's `.claude/agents/` directory.

| Agent | What it does |
|---|---|
| `migration-planner` | Plans (doesn't execute) multi-phase framework/API/runtime migrations |
| `doc-sync` | Audits docs against actual code behavior and reports drift, doesn't rewrite unprompted |
| `release-manager` | Orchestrates a version bump + changelog + tag, stops short of pushing without confirmation |

### Hooks (`hooks/`)
Each `.md` file documents one hook: the shell script plus the `settings.json` block to wire it
in. Covers a common trio: blocking destructive Bash commands, auto-formatting on every edit, and
a desktop/webhook notification when a session finishes.

### Starter config (`settings/settings.starter.json`)
A combined `settings.json` wiring up all three hooks with a sensible starting
permissions allow/ask/deny list. Merge it into your existing settings rather than overwriting —
Claude Code settings are additive across user/project/local scope.

## Install

1. Copy the folders you want into your project's `.claude/` directory (or `~/.claude/` for
   user-wide availability across all your projects):
   ```
   cp -r skills/* your-project/.claude/skills/
   cp -r agents/* your-project/.claude/agents/
   mkdir -p your-project/.claude/hooks
   ```
2. For each hook you want, copy its shell script (from the `.md` file's code block) into
   `.claude/hooks/` and `chmod +x` it.
3. Merge the relevant blocks from `settings/settings.starter.json` into your project's
   `.claude/settings.json` (create one if you don't have it yet).
4. Restart your Claude Code session — skills and subagents are picked up automatically; hooks
   take effect on the next tool call.

## Requirements

- Claude Code (any recent version with skills/subagents/hooks support)
- Bash-compatible shell for the hook scripts (macOS/Linux native; Windows via WSL)
- Language-specific tools referenced by individual skills/hooks (npm, ruff, cargo, etc.) —
  only the ones relevant to your stack, install what you actually use

## License

See `LICENSE.md` — single-purchaser use, no resale or redistribution of the source files.
