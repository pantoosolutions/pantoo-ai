---
name: write-tests
description: Writes tests for a change (uncommitted work, a branch or a slice) with the framework recorded in context/standards.md, asking and saving it on the first run. Tests trace to the spec's acceptance criteria, follow a strategy per kind of file, and never change application code. Use after verify-feature at Beta or GA, or whenever a change needs tests.
argument-hint: "[slice number | uncommitted | <path>]"
---

Recommended: Sonnet · medium; Sonnet · high when the change touches auth, payments or permissions.

Test what a caller relies on and what would break someone, not lines for a coverage number. Writes
test files and, at most, a minimal runner config. Never edits application code to make a test pass.

## 1. Scope

- A path → those files. A slice → its spec's Build plan files plus the branch diff. `uncommitted`, or
  on the base branch → `git diff --name-only --diff-filter=ACMR HEAD` plus
  `git ls-files --others --exclude-standard`. Otherwise the branch since `git merge-base <base> HEAD`,
  uncommitted work included.
- Drop what isn't testable code: existing tests, config, lockfiles, generated output, styles, type-only
  declarations, docs.
- Nothing left → ask: test the last commit (recommended), name files, or stop.
- More than 15 files → ask: logic and API files first (recommended, the rest listed as not covered),
  all of them in batches, or a narrower set.
- The contract: the slice's spec → `## Requirements` (the `AC-n` list), and its latest
  `context/reviews/*-verify.md` for what verify already watched. No spec → test the behaviour the diff
  shows and say the tests aren't traced.

## 2. Framework

Read `context/standards.md` → Testing.

| Testing says | Do |
| --- | --- |
| A framework, path pattern and command | use them |
| No runner, by choice (e.g. "typecheck + verify-feature") | write no suite: run the typecheck through `verifier`, say so, stop |
| Placeholders or `{{TBD}}` | detect, ask, save (below) |

Detect: the package manager from the lockfile; a runner already in the manifest or the repo (`vitest`,
`jest`, `node:test`, `pytest`, `go test`, `cargo test`). Ask one question, recommending the runner
already present, else Vitest (JS/TS), pytest (Python), `testing` + testify (Go). Add an end-to-end tool
(Playwright recommended) only if pages or flows changed. Write the answer into Testing, including
"no runner" when that's the choice.

A tool that isn't installed is a dependency: ask before installing, and add it to `standards.md` →
Approved dependencies. Declined → write the tests anyway and report the install command.

## 3. Write

Read [references/tools.md](references/tools.md) → the section for the chosen runner, and the files
under test. More than ~10 files → the `Explore` agent returns a map first.

| File | Test |
| --- | --- |
| Logic (utils, services, hooks, domain) | Unit: real inputs, asserted outputs; edges and errors exhaustively |
| Component | Render, interact as a user, assert what the user perceives (text, role, state), plus accessibility |
| Page or flow | End to end on the main path and one failure path, if an e2e tool is set; else at component level |
| API route, server action, handler | Integration: call it; assert status, body shape, and the bad input, unauthorized and not found answers |
| CLI or job | Run it; assert exit code, output and side effects, including invalid arguments |

- **Trace:** every automatable AC gets a test with `AC-n` in its name. An AC that can't be automated
  (an email arrives, it looks right) goes under Not covered, owed to `verify-feature`.
- **Calibrate to the roadmap's Principle:** lock in what this slice made real; never assert a real
  backend behind a slice that mocks it by plan.
- **Security:** auth, sessions, permissions, payments or personal data in scope → add forbidden
  access, missing or tampered credentials, and nothing sensitive in responses or logs.
- **Existing tests:** extend the file that covers the source; never write a second one or rewrite
  hand-written tests. One that looks stale → Not covered, for the developer.
- **Config:** create a minimal one only when the runner can't start without it. Never edit an existing one.
- Mock only boundaries (network, database, clock, randomness, file system). Freeze time when it
  matters. No assertion with a fallback (`?? 0`, an optional skip): a missing value must fail.
- Once per new test file: change one expected value, watch the test fail, restore it.

## 4. Run

Run through the `verifier` agent with the terse reporter; on retries, only the failing files.

- Fails because the test is wrong (import, selector, setup) → fix the test.
- Fails because the code breaks its spec → leave it failing, record it under Bugs found, move on.
  Never weaken the assertion or touch the code.

Stop when only real bugs fail or all pass.

## Finish

Tier (the slice's `[tier]`, else the roadmap's): **Beta** and everything passes → offer to mark the
slice `done` and move **Now** and **Next**. **GA** → `review-change` is next. Bugs found → the slice
stays `doing`. Offer a commit (`test(<scope>): …`, no AI attribution); never commit unasked.

```
Tests for <slice NN | the change>: <N tests in M files, X passed, Y failed | written, not run: why>.
Next: <bugs: /pantoo:diagnose-problem <first bug> | Beta: mark done | GA: /clear, then /pantoo:review-change NN | install: <command>>.
Heads-up: <only if real: each bug as path:line and the failed expectation; ACs not covered and why>
Files: <the test files>
```
