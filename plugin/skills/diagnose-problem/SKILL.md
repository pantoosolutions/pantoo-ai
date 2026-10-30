---
name: diagnose-problem
description: When something goes wrong, sorts it before acting. A bug gets a root-cause loop ending in a regression test; a session tangled by failed fixes gets a clean reset; a wrong foundation goes back to its spec. Use when a check fails, behaviour is wrong, verify-feature reports a failure, or two fixes haven't worked.
argument-hint: "[the symptom]"
---

Recommended: Sonnet · high. When a round here didn't land: `/clear`, `/model opus`, Opus · high.

## 1. Capture the symptom

Observed (the exact error, stack trace or wrong output), expected, and how to trigger it (steps,
inputs, environment). From a `verify-feature` report, take the failing AC and its evidence. Any of
the three missing and not derivable → ask. You can't debug what you can't reproduce.

## 2. Sort it

| Signs | Mode |
| --- | --- |
| One place breaks, the rest works, the error is specific, at most one fix has failed | **bug** |
| Two or more fixes failed, fixes patch fixes, the original problem is blurred | **reset** |
| It runs but does the wrong thing by design: a misread requirement, a wrong library API, a pattern that can't hold | **rethink** |

Say the mode and the reason in one line before doing anything else.

## bug

1. **Reproduce** on demand: a failing test, a command, a request. Intermittent → find what makes
   it deterministic (timing, order, data). Can't → add instrumentation and say so; never fix blind.
2. **Localize.** Bisect the code path (log values at midpoints) or the history (`git bisect`,
   `git log -p` on the suspect files). Read the actual values; don't assume them.
3. **One hypothesis at a time,** about the cause, not the symptom ("the date parses as local
   time", not "the value is null"). Test it with the smallest experiment. Refuted → undo the
   experiment and go back to 2.
4. **Fix the root** with the smallest change. No refactor rides along. State outside the code
   (local database rows, files the app wrote) → say what it holds and ask before changing it.
5. **Prove it.** The reproduction passes; the suite passes (through the `verifier` agent); a
   regression test fails without the fix and passes with it, where `standards.md` → Testing puts
   tests. No test runner yet → keep the reproduction as a script and suggest `/pantoo:write-tests`.
6. **Siblings.** Grep for the same bad assumption elsewhere. Fix those in scope; list the rest.

For a long hunt, run steps 1 to 4 in an Agent (`model: sonnet`) given this loop, the symptom and
the reproduction; it must report the cause with its evidence, not just "fixed".

## reset

The session is polluted, and more prompting compounds it.

1. Say so plainly, with what was tried.
2. Show `git status` and `git diff --stat`. Offer to keep what works (commit it on the branch) and
   set the rest aside (`git stash`). Never discard work without an explicit yes.
3. Run `/pantoo:save-session save`: **Problems solved** holds what went wrong and what to avoid;
   **Next** is the first step of a clean attempt from the spec.
4. Stop. Next is `/clear`, then `/pantoo:save-session resume`, with a stronger model or more
   effort for the retry.

## rethink

1. Name the wrong assumption and the evidence against it.
2. Propose the right approach in a few lines, and what it changes in code already built.
3. Don't rebuild. It's a decision: `/pantoo:write-spec NN` updates or supersedes the spec (an
   `Assumed` one gets ratified). A lasting problem in shipped code → a row in `known-issues.md`.

## Finish

Offer the commit; never commit unasked.

```
<Fixed: the root cause in one line | Reset: what to retry | Rethink: the wrong assumption>.
Next: <commit the fix and its test | /clear, then /pantoo:save-session resume | /pantoo:write-spec NN>.
Heads-up: <only if real: siblings left, a design flaw behind the bug, an incident worth a postmortem (/pantoo:write-docs)>
Files: <the files changed, context/session.md, or the spec>
```
