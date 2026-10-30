---
name: capture-ui
description: Records the visual patterns of a UI component just built (surfaces, borders, radius, text roles, spacing, states) in context/ui/registry.md, so every later component matches it. Audit mode scans the whole UI for conflicting patterns and raw values, and sets a baseline once the developer confirms it. Use after building or changing a component, and before the first capture on a UI that wasn't tracked.
argument-hint: "[path | audit]"
---

Recommended: Sonnet · low; Sonnet · medium for `audit`.

The registry is what the next session matches against, so it holds the patterns as built, named by
their `DESIGN.md` token roles. It never defines a value: `DESIGN.md` owns values, `ui/tokens.md` maps
them into the stack.

## capture

1. **Which component.** A path → that file. None → the component files this session or the branch
   added or changed (`git diff --name-only` against the base, plus untracked). Several → capture each.
   Unclear → ask, listing the candidates.
2. **Registry first.** No `context/ui/registry.md` → this isn't set up as a UI project: say so and
   suggest `/pantoo:start-project`. Registry empty and the UI already has more than ~5 components →
   recommend `audit` first.
3. **Read** the component, `context/ui/tokens.md` and `DESIGN.md`. Extract only what makes components
   look like they belong together:

   | Capture | Skip |
   | --- | --- |
   | Surface, border (colour, width), radius, shadow | Width, height, positioning, z-index |
   | Text roles: heading, body, label, muted (size, weight, colour) | Flex or grid structure |
   | Padding inside, gap between elements | Breakpoint variants: the base only |
   | Hover, focus, active, disabled states | Animation timing, unless it's a project rule |
   | Accent use, variants that matter (primary, danger) | One-off content |

   Write each as the class or style the stack uses **and** its token role: `bg-surface` (surface).
4. **Check while extracting.** A raw value (hex, px, a palette class like `blue-500`) where a token
   exists, or a role that contradicts an existing entry for the same kind of component → don't record
   it as the pattern. List it under Heads-up with `path:line` and the token it should use.
5. **Write** under `## Components`, replacing the `_Empty…_` line on the first entry. An entry for the
   same component → update it in place; never duplicate. A new variant of a known component → add a
   row to that entry.

   ```markdown
   ### <Component>

   `<path>` · updated <YYYY-MM-DD> · <purpose, in a few words>

   | Property | Value | Token role |
   | --- | --- | --- |
   | Surface | `bg-surface` | surface |
   | Border | `border border-subtle` | border |
   | Radius | `rounded-md` | radius-md |
   | Text: title / body | `text-base font-semibold` / `text-sm text-muted` | heading / muted |
   | Padding / gap | `p-4` / `gap-3` | space-4 / space-3 |
   | Hover / focus | `hover:bg-surface-raised` / `focus-visible:ring-2 ring-accent` | surface-raised / accent |

   Match: <what later components of this kind must copy; allowed variants>
   ```

## audit

1. Find every component file (the stack's component folders; `Explore` agent for more than ~15 files).
2. Per property in the capture table: list each variant found and where. List every raw value with
   `path:line`.
3. Recommend one baseline per property: what `DESIGN.md` says, else what most components already use.
   Show the report and change nothing yet. Ask the developer to confirm or change each
   recommendation.
4. On confirmation, write `## Baseline, <YYYY-MM-DD>` above `## Components` (property, value, token
   role), then capture each component that matches it.
5. The deviations become a fix list: offer one `known-issues.md` entry (area UI, verdict `accident`,
   severity `medium`, the list in its block), or a cleanup slice through
   `/pantoo:plan-roadmap <slice>`. Fix nothing here.

## Finish

```
Captured <component(s)> | Audited <N> components: <K> conflicts, <R> raw values.
Next: <keep building | confirm the baseline | /pantoo:plan-roadmap "UI cleanup">.
Heads-up: <only if real: raw values and contradictions, as path:line → token>
File: context/ui/registry.md
```
