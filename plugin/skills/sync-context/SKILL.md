---
name: sync-context
description: After a change lands, brings the shared context in line with the code (roadmap statuses, AGENTS.md commands, known issues, env vars, architecture lists) with surgical edits that add lines and never rewrite curated prose. Flags specs the change made stale. Use when a slice is done or merged, or when save-session lists items for shared context.
argument-hint: "[uncommitted]"
---

Recommended: Sonnet · low.

## 1. Scope

- `git fetch --quiet`; behind the base branch → say pull first (a teammate may have synced already).
- The change: on a feature branch, everything since `git merge-base <base> HEAD` plus uncommitted
  work; on the base branch, or with `uncommitted`, the working tree. Use `--name-status`: added,
  modified and deleted each matter.
- Read `context/session.md` → **For shared context**, if it exists.
- Code and manifests are the sources. Docs, tests and lockfiles are context, not changes. Nothing
  left and no session items → "nothing to sync"; stop.

## 2. Update, line by line

Re-read each file right before editing it. Idempotent: a fact already there in any wording isn't
added again, so a second run on the same change makes no edits.

| File | What sync-context may change |
| --- | --- |
| `context/roadmap.md` | Status cells, from evidence. `done` only with the tier's steps run or the developer's word, and then Now and Next too. Lines in Decisions and notes from session items |
| `AGENTS.md` | Commands that were added or renamed; a row in Where things are for a new context file |
| `context/known-issues.md` | An issue the diff fixed → `fixed`. A new issue with a real `path:line` → a summary row and its block |
| `context/standards.md` | The env vars table: a new variable and where it's read |
| `context/architecture.md` | The routes, modules or tables it lists, when the diff adds or removes one |

Flag, don't edit:

- A new dependency missing from `standards.md` → Approved dependencies or from `libraries.md`:
  the developer adds it, or `write-spec` if it was a real choice.
- A spec the code now contradicts → stale: `/pantoo:write-spec NNN` to update or supersede it.
- Every `Assumed` spec → decision debt, `/pantoo:write-spec NNN` to ratify.
- Anything that would rewrite curated prose, reorder slices or add slices (`plan-roadmap`) → listed
  for the developer.

Once session items are in the shared files, set **For shared context** in `session.md` to "none".

## Finish

```
Context synced: <N edits in M files | everything already current>.
Next: <commit the context changes | the first flagged item's command>.
Heads-up: <only if real: stale specs, Assumed specs, dependencies to approve, conflicts>
Files: <the files edited>
```
