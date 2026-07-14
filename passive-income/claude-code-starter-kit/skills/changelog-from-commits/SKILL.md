---
name: changelog-from-commits
description: Generate a CHANGELOG.md entry for a release by reading git log/diff since the last tag and grouping commits into Added/Changed/Fixed/Removed sections. Use when the user asks to "write the changelog," "prepare release notes," or "update CHANGELOG.md" for a new version.
---

# Changelog From Commits

Turn raw commit history into a clean, human-readable changelog entry that follows the
[Keep a Changelog](https://keepachangelog.com/) format.

## Steps

1. Determine the range: find the most recent git tag (`git describe --tags --abbrev=0`). If
   there is no tag, use the repository's first commit. Ask the user for the new version
   number if it isn't obvious from a `package.json`/`Cargo.toml`/`pyproject.toml` bump already
   staged or committed.
2. Pull the commit log for that range: `git log <last-tag>..HEAD --oneline --no-merges`.
3. Read the full diff for context on anything ambiguous — a terse commit message like "fix
   bug" needs the diff to describe *what* actually changed.
4. Classify each commit into one of: `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
   Drop pure chore/internal commits (formatting, CI tweaks, dependency bumps with no
   user-visible effect) unless the user wants an exhaustive log.
5. Write entries as user-facing sentences, not commit messages verbatim — e.g. "fix: null
   check in auth" becomes "Fixed a crash when logging in without a saved session."
6. Insert the new section at the top of `CHANGELOG.md` (create the file with a top-level
   `# Changelog` heading if it doesn't exist yet), dated with today's date.
7. Show the user the drafted section before editing anything if the repo has no existing
   changelog convention to match — otherwise match the existing file's heading style and
   section ordering exactly.

## Notes

- Never invent changes that aren't in the diff. If a commit's intent is unclear even after
  reading the diff, list it under a generic bullet rather than guessing at user impact.
- Keep each bullet to one line. Split multi-purpose commits into multiple bullets rather than
  writing a run-on sentence.
