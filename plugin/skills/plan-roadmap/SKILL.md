---
name: plan-roadmap
description: Orders a project's work into slices in context/roadmap.md (build order, depth tier, which slices need a spec first) and keeps it current as slices ship. Run bare on a filled roadmap, it says where things stand and what's next. Use after start-project, after a slice ships, or to add one slice.
argument-hint: "[replan | <slice to add>]"
---

Recommended: Opus · high to plan or replan. The bare status readout is fine on Sonnet · low.

## Pick the mode

Read `context/roadmap.md`. No `context/`, or `context/overview.md` still has `{{…}}` placeholders →
stop and point to `/pantoo:start-project`.

| State | Mode |
| --- | --- |
| Roadmap has `{{…}}` placeholders, or a `## Slice detail (from v1 build plan)` section | **plan** |
| Filled, no argument | **status**; offer replan if it finds drift |
| Argument `replan` | **replan** |
| Any other argument | **add** that one slice |

Say the mode in one line and go on.

## Rules for every mode

- The roadmap is shared. Re-read it right before writing and edit cells, rows and lines; never
  rewrite the file. Never delete a row: an out-of-scope slice becomes `dropped`.
- A slice is one page or one cohesive unit, small enough to build and verify in one sitting, and
  builds only on slices before it. Split anything that spans unrelated screens.
- **Spec column, the invent test:** would building it need a decision nobody has made (a provider
  or library, a data model, a cross-cutting pattern, a whole screen with no design, non-trivial
  behaviour such as search)? Yes or unsure → `needed`. Blank only when a spec, `architecture.md`,
  `DESIGN.md` or `standards.md` already settles everything. Two decisions in one slice → two specs.
- **Notes** is the slice's done-when seed: one line of observable outcomes, about 25 words at
  most ("filter the list, the URL reflects it, empty and error states render"). The reason for the
  slice goes in Decisions and notes, not the cell. `write-spec` grows it into acceptance criteria.
  A slice whose tier differs from the project's starts its Notes with the tier: `[GA] …`.
- No build tasks in the roadmap; they live in the spec's Build plan.
- One topic at a time, up to four questions a batch, each with your recommended answer.

## plan

1. Read `context/overview.md` (MVP, scope in and out), `architecture.md`, `security.md` → Project
   mapping (its `todo` rows), `known-issues.md` if present, and `.pantoo.json` (kind, ui).
2. **Principle.** Recommend one with a one-line why for this product, then read only its section
   of [references/approaches.md](references/approaches.md) and slice the way it says: tracer bullet
   (the default for production work), skateboard, UI-first with mock data (prototype grade; say
   so), or journey. Write it as the Principle line.
3. **Gaps the intake skipped.** Ask only those that apply to this product and aren't settled in
   `overview.md`: SEO, analytics and error monitoring, an accessibility target, languages, legal
   (cookie consent, privacy, terms). Each yes becomes a slice or a line in a slice's Notes.
4. **Slices.** Foundations first, as their own slices: scaffold and tooling, data model, the app
   shell and `DESIGN.md` for UI projects, auth when the product needs it. Then feature slices in
   the order the principle sets, then a last phase, `Later`, for deferred nice-to-haves.
   - Existing project: no foundation slices for what exists, and no rows for shipped areas.
     `known-issues.md` blockers and highs become `Phase 0: Fix first`; set those issues to `scheduled`.
   - Security `todo` rows go into the slice they belong to, or one hardening slice.
5. **Depth tier.** Recommend the project default from the risk: throwaway or personal →
   Prototype; internal tool or low risk → Alpha; a real product → Beta; payments, auth with
   personal data, compliance, or a team codebase → GA. The tier sets what runs after
   `build-feature`: Prototype nothing; Alpha `verify-feature`; Beta adds `write-tests`; GA adds
   `review-change` and `write-docs`. It never skips `write-spec` when a decision is owed.
6. Write it: Status (tier; Now = first slice; Next = second), Principle, phases, slices numbered
   `01`, `02`… with status `todo`. Delete every `{{…}}` and `> 🧭 GUIDANCE:` line. A migrated v1
   roadmap: fold `## Slice detail` into each slice's Notes and spec seeds; show what would be lost
   and ask before deleting the section.
7. Show the slice list and ask for changes before finishing.

## status (bare run)

Change nothing. Report:

- Branch, and ahead/behind its remote after `git fetch --quiet` (skip if not a repo).
- Counts by status. For each `doing` slice: the first unchecked Build plan task in its spec, and
  its latest report in `context/reviews/` (`<date>-<NN>-verify.md`, `<date>-<NN>-review.md`).
- Decision debt: every spec with `Status: Assumed`.
- Drift: code, specs or reports for work no slice covers; a `doing` slice with no commits in two weeks.
- Next: the lowest-numbered `todo` slice and its command, `/pantoo:write-spec NN` when its Spec
  says `needed`, else `/pantoo:build-feature NN`.

## replan

1. Reconcile statuses from evidence (code, reports, specs). Never mark `done` what you can't confirm.
2. Enroll build feedback: each spec's `## Follow-up` items and open review findings that aren't
   slices yet become `todo` rows, Spec set by the invent test.
3. Reorder what isn't built; foundations stay first. Risk changed (payments or auth arrived) →
   recommend the tier again.
4. Update Now and Next.

## add

Re-read the roadmap. A slice already there at any status gets its Notes sharpened, not a twin.
Otherwise take the next free number, place it in order, set Spec by the invent test, and inherit the
tier unless the developer says otherwise.

## Finish

```
Roadmap <planned | current | replanned | slice NN added>: <N slices in M phases, tier; or what changed>.
Next: /clear, then <the next slice's command>.
Heads-up: <only if real: decision debt, drift, a blocker>
File: context/roadmap.md
```
