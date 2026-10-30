---
name: write-spec
description: Settles one load-bearing decision for a slice (a provider, data model, screen, behaviour or pattern) through a short interview and writes it to context/specs/NNN-name.md, with acceptance criteria and a build plan, ending at an approval gate. Also updates or supersedes a spec, and ratifies an Assumed one. Use before building a slice whose Spec column says needed, or when build-feature stops at its gate.
argument-hint: "<slice number | the decision>"
---

Recommended: Opus · high. Every later session builds from the spec, so a weak one spreads.

Writes no code. Writes the spec and, once it's approved, the few lines the decision changes in other
context files (step 6).

## 1. Find the decision

- A slice number or name → that roadmap row; its Notes seed the requirements. A decision → the
  slice it belongs to, if any. No argument → the first `todo` slice whose Spec says `needed`;
  none → ask what to decide.
- List `context/specs/`: title lines first, then the first 15 lines of any that look related.
  - An `Assumed` spec on this topic → **ratify** (step 7).
  - A clear overlap → ask: update it in place, supersede it, or write a new one alongside
    (recommend by how much they overlap).
- Read what the decision touches: `architecture.md` (stack, invariants), `standards.md`,
  `libraries.md`, the matching rows of `security.md` → When to check, `known-issues.md` for the
  area, and for UI `DESIGN.md` and `context/ui/`. Build on what the project already uses; a new
  tool needs a reason the existing one can't serve.
- `git fetch --quiet`; behind the base branch → say pull first (a teammate may have specced this).

## 2. Interview

Sort every question. **Infer** what the context files and code already say; never ask it. **Ask**
what only the developer knows: business rules, preferences, compliance. **Recommend** what
expertise settles (which library, which pattern), with a one-line why and the runner-up.

Generate the questions for this decision; there is no fixed list. Cover what applies:

1. **Requirements:** user stories, then acceptance criteria `AC-1…`, each observable and checkable
   on its own, including the failure and edge cases that matter. Confirm the list.
2. **Data:** entities, fields, relationships, constraints, state transitions. Present it in parts,
   never as one accept-all block.
3. **Surface:** endpoints (inputs, outputs, auth, errors) or screens (sections; loading, empty,
   error and populated states).
4. **Tools:** provider and library picks. Ask the `docs-researcher` agent for current APIs and
   versions; don't fill gaps from memory.
5. **Security and edges:** who reads and writes what; how each triggered `security.md` rule is met.
   A slice that touches auth, payments, personal data, uploads or AI calls gets **abuse cases**:
   how a user, a stranger or a script would misuse it (another user's ID, a replayed request, a
   price or quota bypass, two requests at once, an injected prompt). Propose them yourself; each
   one gets an AC that stops it.
6. **Value sourcing:** list every value the criteria need produced, stored or shown, and name where
   each comes from: an input, a column, a derivation, another spec. A value with no source is an
   open decision. Ask it now.

One topic at a time, up to four questions a batch, each with your recommended answer. Anything left
unanswered is `{{TBD: what blocks it}}`; a TBD in a load-bearing part blocks approval.

## 3. Write

`context/specs/NNN-slug.md`: the next free number (three digits), a kebab-case slug of five words
or fewer. Re-list the folder right before writing; never overwrite a spec. Follow
[references/spec-template.md](references/spec-template.md), keeping only the sections that apply,
and order the Build plan by the roadmap's Principle.

## 4. Check it yourself

- Every AC has a Build plan task; every task names its ACs.
- Every abuse case names the AC that stops it.
- Every value the criteria need has a named source.
- Consequences include the negatives.
- At Beta or GA (the slice's `[tier]`, else the roadmap's), offer a read-only check on a different
  model (an Agent with `model: sonnet` when you're on Opus) that hunts for unsourced values and
  decisions a builder would have to invent. Recommend it at GA. Ask it on its own and run it
  before the approval gate, never in the same question as approval. Bring each gap it finds to
  the developer with a recommended fix.

## 5. Approval gate

Show the Summary, the acceptance criteria and the Build plan. Ask: approve, or change something.
Edit and ask again until approved, then set `Status: Approved`. Stopped before approval, the spec
stays `Draft`, and `build-feature` won't build from it.

## 6. On approval, record it

Add lines; never rewrite prose.

- Roadmap: the slice's Spec cell → a link to the spec; its Notes → the done-when outcomes the
  decision settled, replacing any "decide X" wording; a line at the top of Decisions and notes,
  `YYYY-MM-DD · slice NN · <decision> (spec NNN)`.
- `architecture.md`: a new stack choice or invariant. `standards.md`: a new dependency in the
  approved list. `libraries.md`: a section for a new library, from the `docs-researcher` answer.
- Supersede: the old spec's status → `Superseded by NNN`.

## 7. Ratify an Assumed spec

Read its Owed decision, Assumption built on and Code area, then run the interview anchored to what
was built.

- The assumption holds → write the full spec around it; status `Approved`.
- It was wrong → write a new spec, mark the assumed one `Superseded by NNN`, and say plainly that
  the code built on it must be redone (`/pantoo:build-feature NN`).

Never leave a ratified spec `Assumed`.

## Finish

```
Spec NNN <approved | updated | ratified | supersedes NNN>: <the decision in one line>.
Next: /clear, then /pantoo:build-feature NN.
Heads-up: <only if real: a TBD left, a gap the check raised, code to redo>
File: context/specs/NNN-slug.md
```
