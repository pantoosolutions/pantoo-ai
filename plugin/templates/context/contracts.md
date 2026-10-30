# Contracts & Propagation

> 🧭 GUIDANCE: For systems with more than one surface (app + API + mobile + CMS…). Filled
> during the existing-project survey of `start-project`, or alongside architecture during
> a new-project intake. **Delete this file for a single-surface project.** Replace every
> `{{...}}`, delete every `> 🧭 GUIDANCE:` line.
>
> This file answers one question: **when someone changes X, what else has to change, and in
> what order?** Everything here must be specific enough to follow without knowing the system.

## Surfaces

> 🧭 GUIDANCE: Every deployable in the system. This is the shared vocabulary for the rest of
> the file — use these exact names everywhere below.

| Surface | What it is | Location | Consumes | Provides |
| ------- | ---------- | -------- | -------- | -------- |
| {{NAME}} | {{WHAT}} | `{{path or repo}}` | {{surfaces/contracts}} | {{surfaces/contracts}} |

### System map

> 🧭 GUIDANCE: One diagram. Direction of dependency, not deployment topology.

```
{{SYSTEM_DIAGRAM}}
```

---

## Contract Index

> 🧭 GUIDANCE: One row per contract. **Sync** is the risk column — `generated` is safe,
> `derived` is safe if genuinely imported, `manual` rots silently. Sort manual to the top.

| Contract | Source of truth | Consumers | Sync | Risk |
| -------- | --------------- | --------- | ---- | ---- |
| {{NAME}} | `{{path}}` ({{surface}}) | {{surfaces}} | {{generated \| derived \| manual}} | {{low \| medium \| high}} |

---

## Contracts

> 🧭 GUIDANCE: One block per contract. The checklist is the point of this file — write it so a
> build agent can follow it with no prior knowledge. Real paths, real commands, dependency
> order. Build it from the developer's account of the last real change of this kind, not from
> what you assume the steps are.

### {{CONTRACT_NAME}}

**Source of truth:** `{{path}}` in {{surface}} — {{why this one wins}}

**Shape:** {{what it defines, briefly. Link to the schema rather than duplicating it — a copy
here will drift.}}

**Consumers:**

| Surface | Uses it at | Sync | Breaks how |
| ------- | ---------- | ---- | ---------- |
| {{SURFACE}} | `{{path}}` | {{generated \| derived \| manual}} | {{build error \| runtime error \| silent}} |

**When this changes:**

> 🧭 GUIDANCE: Ordered and concrete. Include the commands. Call out the steps that fail
> *silently* — those are the ones that get skipped. Note deploy order if it matters.

1. {{STEP — path + command}}
2. {{STEP}}
3. {{STEP}}

**Verify:** {{how to confirm it propagated — a command, a check, a screen to open}}

**Gotchas:** {{version skew, old clients in the wild, caches, anything that bites. Delete if
none.}}

---

## Shared Vocabulary

> 🧭 GUIDANCE: One concept, one name — the cheapest way to stop cross-surface confusion. Fill
> the "also called" column honestly: those aliases are the drift, and the ones worth renaming
> belong in known-issues.md. Delete the section if the system is genuinely consistent.

| Concept | Canonical name | Also called (and where) | Verdict |
| ------- | -------------- | ----------------------- | ------- |
| {{CONCEPT}} | `{{name}}` | `{{alias}}` in {{surface}} | {{rename \| accepted — why}} |

---

## Cross-Surface Rules

> 🧭 GUIDANCE: Rules that only exist because there is more than one surface. Derive from what
> broke before — ask "what's the last cross-surface bug you shipped?" Each must be flat and
> checkable, same bar as architecture.md invariants.

- {{RULE — e.g. "no surface defines its own copy of a shared type; import from the types package"}}
- {{RULE — e.g. "API responses stay additive; removing a field requires a mobile release first"}}

---

## Known Propagation Gaps

> 🧭 GUIDANCE: Where propagation currently doesn't work — a consumer nobody updates, a manual
> step everyone forgets, a contract with no owner. Cross-reference known-issues.md rather than
> duplicating detail. Delete if none.

| Gap | Contract | Consequence | Status |
| --- | -------- | ----------- | ------ |
| {{GAP}} | {{CONTRACT}} | {{what goes wrong}} | {{open \| accepted \| scheduled}} |
