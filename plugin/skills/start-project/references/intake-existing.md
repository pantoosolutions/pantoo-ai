# Intake: existing project

There is code. Read it first, draft the answers yourself, and have the developer confirm or
correct them. You are an archaeologist first: the code records decisions, some deliberate, some
accidental, some regretted. Reconstruct the record and get a human to rule on the difference.

- **Read before you ask.** Never ask what the code answers. Their time is for intent, history
  and judgement.
- **The code is evidence, not truth.** It says what is, never what should be.
- **Fix nothing.** Anything worth fixing, including a leaked key, goes to `known-issues.md`. A
  leaked secret is reported to the developer at once so they can rotate it.
- **Dominant pattern = rule; the rest are named deviations.** Never average two patterns into a
  rule nobody follows.
- **Be honest about coverage:** what you read, sampled and skipped.
- **Don't run the app.** If only running it answers something, ask the developer to run it and
  paste the output.

## The draft-and-confirm loop

Present findings for correction instead of asking open questions. Batch three to five related
ones.

```
Observed: src/lib/db.ts:12 exports one client built with the admin key, imported by server
routes and by src/app/dashboard/page.tsx:8 (a client component).
My reading: admin credentials reach the browser bundle.
Deliberate or a bug?
  a) Deliberate: I document it as the pattern
  b) Bug: known-issues.md, and I document the intended pattern
  c) Legacy: tell me the target; I document that, with this as debt
```

Track a label on every claim while you work: **Observed** (cite `path:line`), **Inferred**
(cite two or three examples; must be confirmed), **Unknown** (must be asked; unanswered becomes
`{{TBD: …}}`). The labels don't go in the files; an unconfirmed inference must not either.

Every convention gets a verdict: **Standard** (the rule), **Legacy** (document the target, log
the old pattern), **Accident** (not a convention, log it). When unsure, ask: "if you wrote a new
file today, would you copy this?"

### Inconsistencies end in a decision

Sweep for them in every phase and report counts, not impressions ("23 greys, 5 cover 80%").
Present each with four parts: **what you found, with counts · what it costs · your
recommendation · what you might be missing.**

Soft answers: "both are fine" → "a new file tomorrow copies which?"; "don't worry about it" →
record as an accepted deviation with the reason; "fix it all" → cleanup is roadmap work with a
cost, ask which items block work; "don't remember why" → check `git blame` on the odd one out;
silence → ask once more, then `{{TBD: two competing patterns, see known-issues.md}}`. Challenge,
then accept their call.

A resolution lands in two places, sometimes three: the **rule** (standards, ui/rules or
architecture, stated without hedging), the **deviations** with file names (`known-issues.md`),
and the **cleanup** only if they want it scheduled (noted for `plan-roadmap`).

### Questions only the developer can answer

Why the big decisions were made and whether they still hold · what was built and ripped out ·
who the user really is · dead vs dormant code · what hurts to touch · which of two patterns is
the future · what must never break, and any incident behind it.

## Phases

```
Phase 0  Scope and recon         agree what "the project" is; harvest prior docs; orientation gate
Phase 1  Product                 context/overview.md
Phase 2  Architecture as built   context/architecture.md
Phase 3  Contracts               context/contracts.md (multi-surface only)
Phase 4  Design as built         context/ui/tokens.md, rules.md, registry.md (UI only)
Phase 5  Standards as practised  context/standards.md, security.md, libraries.md
Phase 6  Debt                    context/known-issues.md
Phase 7  Verification            re-ground citations, contradiction sweep, coverage
```

Template GUIDANCE lines number phases for new projects; follow these numbers instead.

### Phase 0: Scope and recon

1. **What is "the project".** Apps or repos that share a contract (schema, API, shared types,
   design tokens, events) are one system: one `context/` in the parent folder, each repo's
   `AGENTS.md` pointing at it, the primary surface read deepest. Unrelated apps in one repo:
   document one and say the others aren't. Ask what to leave alone (vendored, generated, legacy).
2. **Budget.** Under ~100 source files: read nearly all. 100–600: config, entry points, routes
   and data layer in full; one sample per component cluster. Over 600 or a monorepo: narrow to
   one package first, or label the result shallow. Never read lockfile bodies, dependencies,
   build output or generated clients.
3. **Harvest prior docs** as developer statements to verify, not facts: README, `docs/`, ADRs,
   every instruction file found in SKILL.md step 1, lint/format/type/CI config, API specs,
   Storybook, tests, `TODO`/`FIXME`.
4. **Read outside in:** manifest and scripts → lockfile versions → README → `.env.example` →
   entry points → routes or commands → data layer → shared `lib/` → one feature end to end →
   tests → `git log --oneline -50`.
5. **Gate:** one page with what it is, for whom, the stack, the main surfaces, and the three
   things you're least sure of. Get an explicit "yes" before Phase 1.

### Phase 1: Product → `overview.md`

Routes and nav give the pages; UI copy gives the vocabulary; tests give the flows someone
protected. Ask why it exists, for whom, what "working" means. Mark every in-scope feature
`shipped`, `partial` (say what's missing), `stubbed`, `dead` (confirmed) or `planned` (not built;
for the roadmap). Out of scope must record what was **built and removed, and why**. Trace the
core flow through real files and walk the developer through it. Where README and code disagree,
ask; don't pick.

### Phase 2: Architecture as built → `architecture.md`

Stack rows from manifests with **lockfile versions**; flag declared-but-unused and
used-but-undeclared dependencies. Real folder tree, then "intended or sediment?". Boundaries from
the actual import graph, each ruled intended or not; violations of intended ones are debt. One
traced operation per kind (mutation, background job, external call). Schema vs app types: drift
is a finding. Where the auth check happens and what bypasses it. Canonical snippets copied from
named files. Invariants from defensive patterns plus "what would scare you if it broke?". An
invariant the code violates stays an invariant; the violation goes to `known-issues.md`.

Multi-surface: a system map first (surfaces, who talks to whom, direction), each surface's stack
separately, and the shared package's real use: what's duplicated outside it.

### Phase 3: Contracts → `contracts.md` (multi-surface only; otherwise delete the file)

For each contract (schema, API, shared types, events, tokens, shared env keys, auth claims):
find consumers by searching for its names in every surface; ask which copy is right when they
disagree; mark each link generated, derived or **manual** (count the manual ones: each is a
standing risk). Write the **propagation checklist** from the last real change of that kind: real
paths and commands, in order, ending in how to verify. Drift between definition and consumers
goes to `known-issues.md`.

### Phase 4: Design as built (UI only; otherwise delete `context/ui/` and `context/designs/`)

1. Token source: `DESIGN.md` first; ask whether it records what's built or is the redesign
   target (target → differences are drift in `known-issues.md`; never averaged). It must lint
   clean. Else a theme config, CSS variables or token JSON is the source. Else count every
   colour, spacing, radius and font size in the components and present the histogram for a
   ruling; collapsed values are cleanup.
2. `rules.md` from what components do, each with a verdict; Do Nots earned from the deviations
   found.
3. `registry.md` starts **full**: every component with path, purpose, variants that matter,
   where used. Flag duplicates (which is canonical?), orphans and copy-pasted one-offs. This is
   what stops a build agent rebuilding what exists.
4. Several surfaces rendering one brand: ask first whether they are meant to look like one
   product; extract per surface, then diff; near-matches (`#F5F5F5` / `#F4F4F5`) are drift.

### Phase 5: Standards as practised

- `standards.md`: enforced rules first (formatter, linter, type strictness, CI), written verbatim.
  Then unenforced conventions with counts ("18 of 21 modules use named exports"), each with a
  verdict. Approved dependencies from the manifest, each marked keep / on the way out / don't
  add more like this. Testing section from the test setup actually present.
- `security.md`: audit against the security rules and fill Project mapping from evidence
  (mechanism, `path`, `done` / `partial` / `todo` / `n/a — reason`). First: client-side or
  committed secrets (1–3), tables without RLS (4), endpoints with no server-side auth (6), raw
  bodies written to the database (8), `catch` blocks that allow in auth or payment code (22). Confirmed gaps go to `known-issues.md`, area `security`.
- `libraries.md`: from real call sites at the lockfile version: initialisation, client/server
  split, the project's wrapper, gotchas from comments and commits, the canonical example file.

### Phase 6: Debt → `known-issues.md`

Everything ruled Legacy or Accident, plus duplicates, suspected-dead code (confirm before anyone
deletes), schema and contract drift, manual propagation links, invariant and boundary violations,
security gaps (a leaked secret or user data without RLS is a `blocker`), untested critical paths,
TODOs worth keeping, and "the part I hate touching". Each: what, `path:line`, why it matters,
suggested fix, severity. Fix nothing.

### Phase 7: Verification

A retrofit's risk is confident fiction. Re-open every `path:line` you cited. Re-run the searches
behind inferred claims. Check that every inference got a verdict and every inconsistency reached
a decision ("varies" is unfinished). Check against the code: every route, component, dependency
and entity named exists. Multi-surface: dry-run one propagation checklist end to end. Fill
"Coverage of This Review" in `known-issues.md`, anchored to the commit SHA and branch.

Then tell the developer: what's safe to trust, what's TBD and what would resolve it, the top
debt items with your severity read, and the three decisions to revisit before new work.
