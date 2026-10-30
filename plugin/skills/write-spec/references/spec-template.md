# Spec template

Copy from the line below `---`. Keep only the sections and Design parts that apply. Write tight:
later builds load this file, so every line costs on each one. The build sections come first;
`build-feature` stops reading at `## Record`.

---

# NNN. <The decision as a noun phrase>

Status: Draft
Date: YYYY-MM-DD
Slice: NN <name> (context/roadmap.md), or "none: standalone decision"
Related: <links to other specs; delete the line if none>

## Summary

<Two to four plain sentences: what was decided, why, and what it means for building.>

## Decision

**Chosen:** <option name>. <One sentence stating the decision.>

## Requirements

User stories:

- As a <role>, I want <capability> so that <outcome>.

Acceptance criteria, the contract `build-feature` builds to and `verify-feature` checks:

- **AC-1**: <an observable outcome>
- **AC-2**: <the failure or edge case that must be handled>

Abuse cases (only when the slice touches auth, payments, personal data, uploads or AI calls):

| Abuse case | Stopped by |
| --- | --- |
| <a signed-in user changes the order ID in the URL to another user's> | AC-3 |

## Design

**Data model:** <entities; fields, required or nullable; relationships; unique constraints.
Migration: one, sliced across slices, or none.>

**States:** <draft → submitted → paid>

**Surface:**

| Endpoint or screen | Inputs | Outputs or states | Auth | Errors |
| --- | --- | --- | --- | --- |

**Value sourcing:**

| Action | Value | Source |
| --- | --- | --- |
| <action> | <a value it produces or shows> | <input · column · derived from X · spec NNN> |

**Invariants:** <rules that must always hold, and where each is enforced>

**Security:** <who reads and writes what; each triggered security.md rule and how it's met>

**Config:** `ENV_VAR`: <purpose; server-only or public>

**UI:** <DESIGN.md tokens and registry components used; new components to record with capture-ui>

## Build plan

Ordered by the roadmap's Principle. `build-feature` ticks each task as it lands.

- [ ] 1. <task> → AC-1
- [ ] 2. <task> → AC-2, AC-3

## Consequences

- Positive: <what improves>
- Negative: <what it costs or makes harder; required>
- Commits us to: <migrations, new patterns, lock-in>

## Follow-up

- <later work or open questions; plan-roadmap turns them into slices>

## Record

### Context

<The problem and the forces that shaped the choice: constraints, cost, risk. No options here.>

### Options

1. **<Name>**: <one or two sentences>. For: <load-bearing upside>. Against: <load-bearing cost>.
2. **<Name>**: …

<Two to four options. Delete this section when recording a decision made earlier with no
alternatives weighed.>

### Rationale

<Why the chosen option wins, tied to the forces in Context. A few sentences, not the pros and cons
again.>
