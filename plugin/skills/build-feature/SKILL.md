---
name: build-feature
description: Builds one roadmap slice from its spec. Gates first, and stops when a load-bearing decision is still unmade; then builds, self-checks, ticks the spec's build plan and moves the roadmap. Use to build or resume a slice ("build 03", "continue the checkout slice").
argument-hint: "[slice number or name]"
---

Recommended: Sonnet · medium; Sonnet · high for auth, payments, permissions, uploads or
migrations. On Opus, plan the chunks and hand them to the `implementer` agent.

## 1. Find the slice

An argument → that roadmap row. None → the roadmap's **Now**, else the first `todo`. Status `done`
or `dropped` → say so and ask before touching it; a change to shipped work may need its own slice.
No roadmap and a one-off request → build it against `AGENTS.md` and `standards.md` and skip every
roadmap step.

Before changing anything (skip what doesn't apply, such as git outside a repo):

- `git fetch --quiet`; behind the base branch → say pull first.
- On `main` or `master` → offer a branch `feat/NN-<slug>` (recommended).
- Uncommitted changes in files this slice touches → ask to commit or stash them first.
- No project to build into (no manifest, no source) and this isn't the scaffold slice → stop:
  the scaffold slice comes first.

## 2. Gate

Read the slice's spec from the top down to `## Record`; read the Record only when a constraint
needs its reasoning.

| Spec | Do |
| --- | --- |
| `Approved` | build |
| `Assumed` | build against the assumption; carry the ratify reminder to the summary |
| `Draft` | stop: `/pantoo:write-spec NN` to finish and approve it |
| `Superseded by NNN` | use NNN |
| none; Spec column says `needed` | a decision is owed: ask (below) |
| none; Spec column blank | run the coverage test |

**Coverage test.** Run it before any code, on an Approved spec too. List every value the slice
must produce, store or show; each needs a named source in the spec, `architecture.md`, `DESIGN.md`
or an existing pattern. A decision is also owed when you'd have to pick a provider, library, data
model or cross-cutting pattern, design a whole screen with no `DESIGN.md` direction, or invent
behaviour nobody defined. A choice that decides where a value comes from is never a local detail,
however small it looks.

Owed → ask, recommending the first:

1. **Spec it first** → stop with `Next: /pantoo:write-spec NN: <the decision>`.
2. **Not needed** → build.
3. **Build now on an assumption** → first write `context/specs/NNN-slug.md` (next free number)
   and link it from the slice's Spec cell:

   ```markdown
   # NNN. <the decision>

   Status: Assumed
   Date: YYYY-MM-DD · authorized by <developer> during build-feature
   Slice: NN <name>

   ## Owed decision
   ## Assumption built on
   ## Code area
   ## Requirements
   <AC seeds from the slice's Notes>
   ```

   That's the only spec content this skill writes. A gap found in an Approved spec goes back to
   `write-spec`; never patch it here.

## 3. Build

1. Roadmap: slice → `doing`, **Now** → this slice. Resume at the first unchecked Build plan task,
   never redoing a ticked one, and say where you pick up ("3 of 7 done, resuming at the API route").
2. Read what the tasks touch: `standards.md`, `architecture.md` (invariants), `libraries.md`, the
   triggered rows of `security.md`, and `known-issues.md` for the area (don't copy a listed
   mistake; don't "fix" an `intentional` one). UI: `DESIGN.md` and `context/ui/` (tokens, rules,
   registry); reuse registry components and never invent a token.
3. An unfamiliar area, or more than ~3 files to locate → the `Explore` agent returns a map (files,
   patterns to match, helpers to reuse). Build from the map.
4. Build in Build plan order. On Opus, give each chunk to the `implementer` agent with its exact
   files, tasks and ACs, and review what comes back. Tick each task in the spec once it lands and
   typechecks.
5. While building:
   - The spec is wrong (the data model can't hold, an AC contradicts the surface) → stop before
     coding the deviation: `/pantoo:write-spec NN` updates it, then resume.
   - A migration is done only when it's applied and the live schema confirmed.
   - Replacing code includes deleting the old: no callers left, checks green.
   - Scope is the slice. Adjacent problems go in the summary, not the diff.
   - A workaround, or a departure from a context file → a line in the roadmap's Decisions and notes.
6. A test you add as a guard: break what it guards once (revert the value, delete the token) and
   watch it fail, then restore. A guard that can't fail guards nothing.
7. Self-check through the `verifier` agent: typecheck, build, lint, and the tests that exist. Fix
   what you broke.

## 4. Close

- Tick only what landed and passed. A half-done task stays unticked, and the summary says what's left.
- Tier (the slice's `[tier]`, else the roadmap's): **Prototype** → offer to mark the slice `done`.
  Any other tier → the slice stays `doing` and `verify-feature` is next. `done` is always the
  developer's call; an Assumed spec doesn't block it.
- Marking `done` also moves **Now** and **Next** to the next `todo` slices.
- A UI slice that added a component → suggest `/pantoo:capture-ui`.
- Offer a commit with a Conventional Commit subject and no AI attribution; never commit unasked.

```
Built slice NN <name>: <what works now, in one line>.
Next: /clear, then <by tier: /pantoo:verify-feature NN | mark done, then /pantoo:build-feature <next>>.
Heads-up: <only if real: tasks left, an Assumed spec to ratify (/pantoo:write-spec NN), problems spotted nearby>
Files: <spec path>, context/roadmap.md
```
