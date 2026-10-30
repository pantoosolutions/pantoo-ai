# Roadmap

> 🧭 GUIDANCE: Written by `plan-roadmap`. Slices in build order: foundations first, each slice
> builds only on shipped ones, small enough to verify in one sitting. `build-feature` and
> `sync-context` keep Status and the log current. Replace every `{{...}}`, delete every
> `> 🧭 GUIDANCE:` line.

## Status

**Depth tier:** {{Prototype | Alpha | Beta | GA}}
**Now:** {{CURRENT_SLICE}}
**Next:** {{NEXT_SLICE}}

> 🧭 GUIDANCE: Tiers are cumulative. Prototype = it runs. Alpha = + verify against the spec.
> Beta = + tests. GA = + fresh-model review and docs. Suggested per project or slice, never
> enforced.

## Principle

> 🧭 GUIDANCE: One line. UI-first with mock data, then wire logic; or contract first, then
> implementation (API, CLI).

{{BUILD_PRINCIPLE}}

## Slices

> 🧭 GUIDANCE: Status is one of `todo`, `doing`, `done`, `blocked`, `dropped` (rows are never
> deleted). Spec is blank when nothing is undecided, `needed` when a load-bearing choice is still
> open (`write-spec` runs first), then a link to the file in `context/specs/`. Notes is one line
> of observable done-when outcomes; a slice whose tier differs from the project's starts it with
> the tier, e.g. `[GA]`.

### Phase 1: {{PHASE_NAME}}

| # | Slice | Status | Spec | Notes |
| - | ----- | ------ | ---- | ----- |
| 01 | {{SLICE}} | todo | | {{ONE_LINE}} |
| 02 | {{SLICE}} | todo | | {{ONE_LINE}} |

### Phase 2: {{PHASE_NAME}}

| # | Slice | Status | Spec | Notes |
| - | ----- | ------ | ---- | ----- |
| 03 | {{SLICE}} | todo | | {{ONE_LINE}} |

## Decisions and notes

_Added during the build: decisions with their reason, workarounds, anything that differs from
the other context files. Newest first._
