# Known Issues & Deviations

> 🧭 GUIDANCE: Produced by the existing-project survey of `start-project`. New
> projects don't need this file — delete it from a fresh `context/` folder. Replace every
> `{{...}}`, delete every `> 🧭 GUIDANCE:` line.
>
> This is the honest ledger of what's wrong, half-done, or deliberately weird in the codebase.
> Its job is to stop a build agent from copying a mistake, and to stop it from "fixing"
> something that's intentional. Intake **records** these; it never fixes them.

## How to read this file

**Verdict** — why the entry is here:

| Verdict | Meaning |
| ------- | ------- |
| `legacy` | Real pattern, still present, but not the target. A target exists. |
| `accident` | Nobody intended this. Not a convention — do not copy it. |
| `risk` | Works today, but fragile, unguarded, or untested. |
| `intentional` | Looks wrong, is deliberate. **Do not "fix" this.** |

**Severity** — `blocker` (unsafe to build on) · `high` (will cause bugs) · `medium` (slows work
or spreads) · `low` (tidy-up).

**Status** — `open` · `accepted` (won't fix, on purpose) · `scheduled` (in roadmap.md
Phase 0) · `fixed` (keep briefly, then delete).

---

## Summary

> 🧭 GUIDANCE: Keep this table in sync with the entries below. Sort by severity.

| ID | Issue | Area | Verdict | Severity | Status |
| -- | ----- | ---- | ------- | -------- | ------ |
| KI-01 | {{SHORT_TITLE}} | {{AREA}} | {{VERDICT}} | {{SEVERITY}} | open |

---

## Issues

> 🧭 GUIDANCE: One block per issue. Cite real `path:line` locations — a finding without a
> location is a rumor. Delete the example block once real entries exist.

### KI-01 — {{SHORT_TITLE}}

- **Area:** {{architecture / ui / data / auth / security / build / tests / deps}}
- **Verdict:** {{legacy | accident | risk | intentional}}
- **Severity:** {{blocker | high | medium | low}}
- **Status:** open
- **Where:** `{{path:line}}`{{, and N other files — list or characterize them}}
- **What:** {{What the code actually does, factually.}}
- **Why it matters:** {{The concrete consequence. If there isn't one, this is a low.}}
- **Target / suggested fix:** {{What it should be instead, and roughly what changing it takes.}}
- **Notes:** {{History, prior attempts, why it hasn't been fixed. Delete if none.}}

---

## Pattern Deviations

> 🧭 GUIDANCE: Where the codebase disagrees with its own documented rules. The rule lives in
> standards.md / ui/rules.md / architecture.md; the exceptions live here. Delete the
> section if there are none.

| Rule (and where it's written) | Files that deviate | Verdict | Status |
| ----------------------------- | ------------------ | ------- | ------ |
| {{RULE}} — {{file.md}} | {{path(s)}} | {{legacy \| accident}} | open |

---

## Duplicate Implementations

> 🧭 GUIDANCE: Two or more things that do the same job. Name the canonical one — the build
> agent needs to know which to use and which to stop extending. Delete if none.

| What | Implementations | Canonical | Plan for the others |
| ---- | --------------- | --------- | ------------------- |
| {{THING}} | `{{path}}`, `{{path}}` | `{{path}}` | {{migrate / delete / leave}} |

---

## Dead & Suspected-Dead Code

> 🧭 GUIDANCE: `dead` = confirmed unreachable and confirmed by the developer.
> `suspected` = nothing imports it, but not confirmed. **Never let anything be deleted on a
> `suspected` label alone** — dynamic imports, string-based routing, and external callers all
> hide real usage. Delete the section if none.

| Path | Status | Evidence | Developer verdict |
| ---- | ------ | -------- | ----------------- |
| `{{path}}` | {{dead \| suspected}} | {{no importers / route removed / last touched YYYY-MM}} | {{delete / keep — why / unconfirmed}} |

---

## Invariant & Boundary Violations

> 🧭 GUIDANCE: Places where the code breaks a rule that architecture.md states. The rule stays
> as written there — do not weaken it to match the code. Delete if none.

| Invariant / boundary | Violated at | Severity | Status |
| -------------------- | ----------- | -------- | ------ |
| {{INVARIANT}} | `{{path:line}}` | {{severity}} | open |

---

## Untested Critical Paths

> 🧭 GUIDANCE: Flows the developer called important that have no test coverage. This is what
> tells a build agent where to be careful and where a change needs manual verification.
> Delete if none.

| Flow | Where it lives | Coverage | Risk if it breaks |
| ---- | -------------- | -------- | ----------------- |
| {{FLOW}} | `{{path}}` | {{none / partial — what's covered}} | {{consequence}} |

---

## Harvested TODO / FIXME / HACK

> 🧭 GUIDANCE: Only the ones that still matter — a dump of every TODO in the repo is noise.
> Anything genuinely important should be promoted to a numbered issue above. Delete if none.

| Location | Comment | Still relevant? |
| -------- | ------- | --------------- |
| `{{path:line}}` | {{text}} | {{yes / no / ask}} |

---

## Coverage of This Review

> 🧭 GUIDANCE: What the intake actually looked at. Without this, absence of an issue reads as
> evidence there isn't one. Fill from the verification phase's coverage report. For a multi-surface system,
> break this down per surface — coverage is rarely even across them.

- **Read in full:** {{areas}}
- **Sampled:** {{areas, and the sampling approach}}
- **Not reviewed:** {{areas, and why}}
- **As of:** commit `{{SHORT_SHA}}` on `{{BRANCH}}`, {{YYYY-MM-DD}}
