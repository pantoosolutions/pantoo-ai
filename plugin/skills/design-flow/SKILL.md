---
name: design-flow
description: Routes design work in a UI project to the right tool for the step it's at (impeccable to brief, shape, critique, audit and polish; taste to generate; ui-ux-pro-max to look things up) and keeps DESIGN.md, PRODUCT.md and context/ui/ each owning their part. Also records where the design comes from (Figma, a token file, a brand kit, an export) and syncs DESIGN.md from it. Use when starting the look of a UI project, before building or reviewing a screen, when the look or its source changes, or when unsure which design tool to use.
argument-hint: "[look | sync | screen <name> | review <screen> | change-look]"
---

Recommended: Opus · high to set the look and for the first screens; Sonnet · medium for screens
that reuse the registry.

One generator, one reviewer: **taste** shapes what gets built, **impeccable** judges it,
**ui-ux-pro-max** is a reference to look things up in. Never ask two of them to build the same screen.

## Who owns what

| File | Owns | Written by |
| --- | --- | --- |
| `PRODUCT.md` | audience, tone, what good looks like; impeccable judges against it | `/impeccable init`, from `context/overview.md` |
| `DESIGN.md` | every token **value** (colour, type, spacing, radius, shadow) | step `look`; linted clean |
| `context/designs/README.md` → Sources | where the design comes from; `DESIGN.md` is downstream of every row | steps `look` and `sync` |
| `context/ui/tokens.md` | how the stack references each token; never a value | `start-project` |
| `context/ui/rules.md` | patterns and Do Nots | `start-project` |
| `context/ui/registry.md` | components as built | `capture-ui` |
| `CLAUDE.md` → Design | the taste dials and the export command for this project | this skill |

Two files disagree → `DESIGN.md` wins; fix the other. A source upstream disagrees → `sync` asks.

## 1. Where is the project?

Check, in order, and run the first step that applies (an argument names the step directly):

1. Not a UI project (`.pantoo.json` → `ui: false`) → say so and stop.
2. impeccable or taste not installed (no `impeccable` or `design-taste-frontend` skill at user or
   project scope) → `npx pantoo-ai add design`, then restart Claude Code.
3. `context/overview.md` still has placeholders → `/pantoo:start-project` first: the product comes
   before the look.
4. No `PRODUCT.md` → `/impeccable init`, telling it to take the answers from `context/overview.md` and
   ask only what's missing.
5. No `DESIGN.md` → **look**. `context/designs/README.md` has no `## Sources` → add it from
   `${CLAUDE_PLUGIN_ROOT}/templates/context/designs/README.md` first.
6. `context/ui/tokens.md` still has placeholders → `/pantoo:start-project` (its design phase maps
   `DESIGN.md`).
7. Otherwise → **screen** or **review**, whichever the developer is doing.

## look: choose it, preview it

Read [references/look.md](references/look.md) and follow it: pick a route (an existing brand file, a
generated system, or the project's own designs), write `DESIGN.md`, lint it, preview it as a
throwaway HTML page, iterate there, then record the taste dials.

## sync

The design changed upstream, or a source's version moved: read
[references/sources.md](references/sources.md) → sync and follow it. Every difference is asked about;
nothing is overwritten wholesale, and nothing is written back to the source.

## screen <name>

1. A screen with logic or a load-bearing choice → its slice goes through `/pantoo:write-spec` first.
   Pure layout → `/impeccable shape <screen>` to agree on structure before code.
2. Build it with `/pantoo:build-feature`, UI-first with mock data, against `DESIGN.md`, `PRODUCT.md`,
   `context/ui/` and the dials in `CLAUDE.md`. taste applies while generating; don't name impeccable
   here.
3. `/pantoo:capture-ui` for each new component.
4. **review** below, then commit.

One screen per session: critique gets vague across several.

## review <screen>

| Step | Run | Model |
| --- | --- | --- |
| Design quality against `PRODUCT.md` | `/impeccable critique <screen>`, then fix | Opus · high |
| Accessibility, performance, responsive | `/impeccable audit <screen>`, then fix | Sonnet · medium |
| Final pass | `/impeccable polish <screen>` | Sonnet · medium |
| One aspect off | `/impeccable typeset`, `layout`, `colorize`, `animate`, `bolder`, `quieter`, `clarify` | Sonnet |
| Behaviour against the spec | `/pantoo:verify-feature` (impeccable doesn't check ACs) | Sonnet · medium |

Two layouts in doubt → both as variants on one throwaway route, compared in the browser. Live
iteration in the browser → `/impeccable live`.

## change-look

Edit `DESIGN.md` first, lint, re-export if the stack uses an export (the command in `CLAUDE.md`), then
update `context/ui/tokens.md` and any registry entry whose token role changed. Code that now drifts
from `DESIGN.md` → `/pantoo:capture-ui audit`.

## Finish

```
Design: <step done, in one line>.
Next: <the next step from section 1, as a command>.
Heads-up: <only if real: lint errors left, a value not in DESIGN.md, a skipped step>
Files: <DESIGN.md | PRODUCT.md | CLAUDE.md | context/designs/README.md | none>
```
