---
name: test-gap-finder
description: Find source files, functions, or modules with no corresponding test coverage and scaffold minimal test stubs for them. Use when the user asks "what's not tested," "find test gaps," or "scaffold tests for this module."
---

# Test Gap Finder

Locate untested code and produce scaffolds a developer can fill in — not full tests written
without understanding the intended behavior.

## Steps

1. Detect the test convention already in use in the repo: file naming (`*.test.ts`, `*_test.go`,
   `test_*.py`), directory layout (co-located vs. a top-level `tests/` tree), and the test
   runner/framework (jest, vitest, pytest, go test, etc.). Match it exactly — don't introduce a
   second convention.
2. Build the map of source files to their (if any) corresponding test file. A source file with
   no matching test file at all is the clearest gap; also check partial gaps — a test file that
   exists but only covers 1 of 5 exported functions.
3. For partial gaps, read the existing test file to see which exported functions/methods have
   an `it`/`test`/`def test_` referencing them, and list the ones that don't.
4. Rank gaps by risk, not just by count: exported/public API surface and anything touching
   money, auth, or data mutation outranks a private helper or a pure formatting function.
5. For each gap, scaffold a minimal test file stub in the repo's existing convention:
   - Correct imports for the module under test
   - One `describe`/test group per exported function with a `TODO` placeholder assertion, not a
     fabricated one — never write an `expect(x).toBe(true)` just to make a stub pass silently
   - A comment noting the specific behavior that needs a real assertion (e.g. "TODO: assert
     error thrown when input is negative")
6. Report the gap list and the scaffolds created; don't silently invent test assertions for
   business logic you haven't been told the expected behavior of.

## Notes

- A scaffold with a fake passing assertion is worse than no test — it gives false confidence.
  Always leave a clearly marked TODO instead of guessing at expected behavior.
- If the repo already has strong coverage tooling (`nyc`, `coverage.py`, `go test -cover`),
  prefer reading its report over hand-rolling the source/test mapping.
