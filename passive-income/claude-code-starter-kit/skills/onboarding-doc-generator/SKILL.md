---
name: onboarding-doc-generator
description: Scan a repository's structure, build/run scripts, and conventions to generate or refresh a CONTRIBUTING.md / new-engineer onboarding doc. Use when the user asks to "write onboarding docs," "help a new hire get started," or "generate CONTRIBUTING.md."
---

# Onboarding Doc Generator

Produce an onboarding doc grounded in what the repo actually does — not a generic template.

## Steps

1. Identify the stack: language(s), package manager, framework, monorepo tooling. Read
   `package.json`/`pyproject.toml`/`go.mod`/etc. for the real scripts, not assumed ones.
2. Find the actual setup path: look for an existing `README.md`, `Makefile`,
   `docker-compose.yml`, `.env.example`, or setup scripts. Run nothing that mutates state, but
   read enough to reconstruct the real "clone → install → run" sequence.
3. Identify test/lint/build commands from the manifest's scripts section — these should be
   copy-pasteable, exact commands, not paraphrased ("run the tests" is not good enough; `npm
   test` is).
4. Note repo-specific conventions worth calling out: branch naming, commit message format (if a
   `commitlint` config or CONTRIBUTING precedent exists), required env vars (names only, never
   values), and where core domain logic lives vs. generated/vendored code.
5. Identify any onboarding landmines: a service that needs a specific Node/Python version, a
   local dependency that must be running (database, queue), or a non-obvious first-run step
   (migrations, seed data).
6. Draft `CONTRIBUTING.md` (or update the existing one) with sections: Prerequisites, Setup,
   Running locally, Running tests, Code style/conventions, How to submit a change. Keep it to
   what a new engineer needs on day one — this is not full architecture documentation.
7. Show the draft before overwriting an existing file that has clearly hand-written content —
   merge in new information rather than replacing established guidance the user or team wrote.

## Notes

- Never invent setup steps you haven't verified against the actual manifest/scripts — a wrong
  onboarding doc is worse than none, because it costs a new hire real debugging time.
- Do not include secrets, API keys, or internal URLs even if you find them in local
  `.env`/config files during the scan.
