---
name: verify-feature
description: Runs the real app against a slice's acceptance criteria and reports each one as met, missing, not live or blocked, with the evidence, in context/reviews/. Never edits code. Use after build-feature, before marking a slice done.
argument-hint: "[slice number or name]"
---

Recommended: Sonnet · medium.

Green tests and code that "should work" are not evidence. Pass only what you watched happen.

## 1. Load the contract

- Slice: the argument, else the roadmap's **Now**. From its spec read `## Requirements` (the
  `AC-n` list) and the surfaces in `## Design` (routes, screens, tables, commands). Each AC is a
  behaviour to exercise; each surface must exist. Add one check per Value sourcing row that varies
  the input most likely to break it (timezone, locale, currency, tenant). An AC that stops an
  abuse case is exercised as the abuse itself: the other user's ID, the replayed request, the two
  requests at once.
- No spec: from `git diff` against the base branch and the slice's Notes, write two to five
  behaviours a person could watch, and say they're inferred.
- A behaviour-preserving change (refactor, rename, dedupe; the spec or the developer says nothing
  should change) → read [references/refactor-mode.md](references/refactor-mode.md) and follow it
  instead of steps 2 and 3.
- Calibrate to the roadmap's Principle: under UI-first with mock data, the mocks are the plan, not
  a defect; under tracer bullet, the whole path must be real.
- A previous report for this slice in `context/reviews/` → re-check its failures first.

## 2. Run the app

Use the project's own commands: `AGENTS.md` → Commands, then `package.json` scripts, `Makefile`,
`docker-compose`. In a monorepo, run the affected app. Can't tell how, or it needs seed data or
credentials you don't have → ask.

First, through the `verifier` agent: the project's build and its full test suite. Then every name
the diff references but doesn't define (a token, CSS variable, env var, route, import) resolves:
grep for its definition in the built or generated output, not in the source it's generated from.

Start it in the background, then for each behaviour:

- **UI:** a Playwright script that drives the flow and prints what it found as text, run through
  the `verifier` agent. Take one targeted screenshot only to judge something visual. Scripts go in
  the project's e2e folder if it has one, otherwise outside the repo. Playwright missing → ask
  before adding it; it's a dependency (`standards.md`). Once agreed, set it up with
  [references/browser-checks.md](references/browser-checks.md).
- **API:** send the request; record the status and the key fields of the body.
- **CLI or job:** run it; record the exit code and the output that matters.
- **Data:** query the live schema or rows, not the migration file.

Watch the server and console logs throughout. Record each check as you run it: the command or URL,
and what came back. That ledger is the evidence.

## 3. Verdict per AC and surface

- **met**: passed, and you can cite its ledger line.
- **missing**: specced but never built (no route, no file).
- **not live**: built but failing at runtime, such as a migration written but not applied.
- **blocked**: couldn't be exercised (no credentials, the app won't start). Say what's needed.

No ledger line → not met. The app never started → every item is blocked and the verdict is
BLOCKED. PASS needs every AC met, every surface present, and the build and full suite run;
anything missing or not live is FAIL, and a check not run goes under Failing or owed.

- A test this slice added counts as evidence only after you've read it: it asserts the AC itself,
  and a missing value or a skipped element fails it (no `?? 0` default, no silent skip). Otherwise
  exercise the behaviour directly.
- Every count, name and value in the Evidence column is copied from ledger output, never restated
  from memory.

## 4. Report

Stop every process you started. Change no code and no tests. Write
`context/reviews/<YYYY-MM-DD>-<NN>-verify.md`:

```markdown
# Verify: slice NN <name> · <PASS | FAIL | BLOCKED>

<date> · branch `<branch>` at `<sha>` · spec NNN · ran via `<command or URL>`

| AC | Verdict | Evidence |
| --- | --- | --- |
| AC-1 | met | `POST /api/orders` → 201, body.status "pending" |

## Failing or owed
- AC-n: what went wrong, with the exact error → diagnose-problem | build-feature

## Fragile but passing
- <slow response, console warning, missing empty state>; review-change reads this
```

PASS, and verify is the tier's last step (Alpha) → offer to mark the slice `done` and move **Now**
and **Next**. At Beta and GA the tier's next step follows: `write-tests`, then for GA
`review-change` and `write-docs`.

```
Verify slice NN: <PASS, N of N criteria met | FAIL, M of N failed | BLOCKED: what's needed>.
Next: <PASS at Alpha: mark done | PASS at Beta or GA: /clear, then /pantoo:write-tests NN | FAIL: /pantoo:diagnose-problem <first failure> | missing: /pantoo:build-feature NN>.
Heads-up: <only if real>
File: context/reviews/<file>
```
