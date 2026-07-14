---
name: dependency-upgrade-planner
description: Audit a project's dependency manifest (package.json, requirements.txt, Cargo.toml, go.mod, Gemfile) for outdated and vulnerable packages, then produce a prioritized, risk-ranked upgrade plan instead of a blind bulk bump. Use when the user asks to "update dependencies," "check for outdated packages," or "audit for vulnerabilities."
---

# Dependency Upgrade Planner

Bulk-bumping every dependency at once is how upgrades break production. This skill produces a
plan the user can execute incrementally, safest changes first.

## Steps

1. Identify the manifest(s) in play and the matching lockfile. Multi-language repos may have
   more than one — handle each separately.
2. Get current vs. latest versions:
   - Node: `npm outdated --json` (or `pnpm outdated` / `yarn outdated` if that lockfile is
     present)
   - Python: `pip list --outdated` (respect the project's actual installer — `uv`, `poetry`,
     `pip`)
   - Rust: `cargo outdated` if available, else compare `Cargo.lock` versions to crates.io
   - Go: `go list -u -m all`
3. Cross-reference for known vulnerabilities: `npm audit --json`, `pip-audit`, `cargo audit`,
   or `govulncheck` — whichever applies. Flag any dependency with an open advisory regardless
   of how "outdated" it otherwise looks.
4. Classify each candidate upgrade:
   - **Patch** (x.y.Z) — low risk, batch these together.
   - **Minor** (x.Y.z) — usually safe, but check changelogs for deprecation notices.
   - **Major** (X.y.z) — read the package's changelog/migration guide; call out breaking API
     changes explicitly; these should be upgraded one at a time with their own test run.
   - **Security advisory present** — highest priority regardless of semver distance, upgrade
     first even if it means a major bump.
5. Present the plan as an ordered list: what to upgrade, in what order, why, and what to watch
   for (breaking changes, required code changes). Don't just say "upgrade X" — name the
   specific migration step if the changelog calls one out.
6. Only actually run upgrade commands and edit manifests when the user confirms — this skill
   plans; it doesn't unilaterally rewrite lockfiles for major version bumps without a green
   test run after each one.

## Notes

- Never batch a security-advisory fix behind unrelated minor bumps — ship it on its own so it's
  easy to isolate if something regresses.
- If the project has no test suite, say so explicitly in the plan — that materially raises the
  risk of any major-version upgrade and the user should know before proceeding.
