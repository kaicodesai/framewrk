---
name: conventional-commit-lint
description: Check a staged or drafted commit message against the Conventional Commits spec (type(scope):subject) and rewrite it if it doesn't comply. Use when the user asks to "write a commit message," "lint my commit," or before running git commit if the repo's CONTRIBUTING.md mandates conventional commits.
---

# Conventional Commit Lint

Validate and, if needed, rewrite a commit message to follow
[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

## Steps

1. Check whether the repo actually mandates this convention — look for `commitlint.config.*`,
   a `CONTRIBUTING.md` mention, or a `.git/hooks/commit-msg` hook. If there's no signal either
   way, ask the user once rather than silently imposing a convention on a repo that doesn't use
   it.
2. Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
   `chore`, `revert`. Map the actual change to the closest type — don't default everything to
   `chore`.
3. Scope (optional) should be the module/package/directory most affected, lowercase, no spaces
   — e.g. `feat(auth): add refresh token rotation`.
4. Subject: imperative mood, no trailing period, under ~72 characters, describes the effect of
   the change not the mechanism ("add" not "added" or "adding").
5. Breaking changes: append `!` after the type/scope (`feat(api)!: ...`) and add a
   `BREAKING CHANGE:` footer describing the migration impact.
6. If given a full diff instead of a draft message, derive the type/scope/subject directly from
   the diff rather than asking the user to describe their own change.
7. Output the corrected message and, only if the user confirms, apply it (`git commit -m` for a
   new commit, or note that amending requires `git commit --amend` and confirm before running
   anything that rewrites history).

## Notes

- Never amend or rewrite a commit that has already been pushed without explicit confirmation —
  that rewrites shared history.
- If the message already complies, say so briefly instead of "fixing" something that isn't
  broken.
