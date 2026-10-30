---
name: review-change
description: A fresh-model code review of a branch or an uncommitted change, in three layers. Does it match the spec, does it respect the system (architecture, standards, design, security), is it ready for production? Runs on a different model than wrote the code, writes ranked findings to context/reviews/ and fixes nothing. Use before a PR, and for every slice at GA tier.
argument-hint: "[slice number | uncommitted | release | with <model>]"
---

Recommended: Sonnet · low for this session. The review itself runs in the `deep-reviewer` agent.

## 1. Scope

- Base: `main` if it exists, else `master`. On the base branch, or with `uncommitted` → the working
  tree (`git diff HEAD` plus untracked files). Otherwise the branch since
  `git merge-base <base> HEAD`, uncommitted work included.
- Nothing changed → say so and stop.
- The spec: the slice in the argument, else the roadmap's **Now**, else a spec the branch name or
  the diff points to. None → review against the context files alone, and say so.
- **Sensitive** if the diff touches auth, payments, permissions, uploads, migrations or secrets, or
  anything a client will see.

## 2. Pick a reviewer that didn't write the code

A model reviewing its own output shares its blind spots. Ask once which model wrote most of the
code, recommending this session's model (work handed to `implementer` was Sonnet).

| Author | Reviewer |
| --- | --- |
| Sonnet or Haiku | `deep-reviewer` (Opus) |
| Opus | `deep-reviewer` with `model: sonnet` |
| Fable | `deep-reviewer` (Opus) |

Never the author's model, never Haiku. `with <model>` overrides the table unless it names the
author. Opus wrote a sensitive change → also offer Fable as the reviewer; it bills to usage
credits, so only on an explicit yes. Say the choice in one line before starting.

## 3. Review

Spawn the reviewer with the base, the diff command, the changed files, the spec path (read down to
`## Record`) and this brief:

> Review in three layers and tag each finding with its layer.
> 1. **Plan:** every acceptance criterion is implemented, the ones that stop an abuse case
>    included; nothing was built that the spec or the slice didn't ask for.
> 2. **System:** `architecture.md` boundaries and invariants; `standards.md` conventions and approved
>    dependencies; existing patterns reused, not duplicated; no pattern copied that
>    `known-issues.md` lists as a mistake; UI against `DESIGN.md` and `context/ui/registry.md`, with
>    no invented tokens.
> 3. **Production:** errors handled; loading, empty and error states; edge cases; the `security.md`
>    rules the diff triggers; tests where `standards.md` → Testing requires them.
> Also read the slice's latest `context/reviews/*-verify.md` → Fragile but passing, if there is one.
> End with a verdict: approve, approve with nits, changes requested, or blocked.

With `release`, add: "Release pass: check every rule in `security.md`, the extended parts of a
rule included. For each Project mapping row that is `todo` or `partial`, say what the code does
now, with `path`, so the mapping can be updated."

## 4. Report

The reviewer can't write files, so you write its findings to
`context/reviews/<YYYY-MM-DD>-<NN or branch>-review.md`, most severe first, under one header line:
verdict, reviewer model, `base..head`, spec. The reviewer failed or returned nothing → say so and
offer to re-run; never write an empty or invented review.

Then stop and fix nothing until the developer picks what to fix. A finding they call intentional is
marked `accepted` in the report, and goes into `known-issues.md` if it's a lasting deviation.
After a release pass, offer to update the `security.md` Project mapping rows the reviewer settled
with evidence (How, Where, Status); write them once the developer agrees.

```
Review <slice NN | branch>: <verdict>, <B> blockers, <H> high (reviewed by <model>).
Next: <blockers: /pantoo:build-feature NN or /pantoo:diagnose-problem | GA: /pantoo:write-docs | mark the slice done>.
Heads-up: <each blocker as path:line and one line>
File: context/reviews/<file>
```
