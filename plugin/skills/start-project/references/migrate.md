# Migrate an older context

Moves a project's existing context into the current layout without losing content. Migration
moves and merges; it doesn't fill gaps. Placeholders that were empty before stay empty, and the
intake resumes on them afterwards.

## Before anything

1. `git status -- context CLAUDE.md AGENTS.md memory.md`. Uncommitted changes there: ask the
   developer to commit them first (recommended), so the migration is one reviewable diff.
2. Show the plan as a table (old path → new path, and what merges where) and wait for approval.
   Ask first in the same message whether the kit can be committed here or stays local (as in
   SKILL.md step 2), unless `.pantoo.json` already says.
3. Use `git mv` for renames so history follows the files (plain `mv` when untracked).
4. A v1 file that is still an unfilled template (only `{{…}}` and GUIDANCE, nothing the developer
   wrote) isn't merged: rename it, then replace its body with the v2 template.

## v1 → v2 (the Helpers `context-base` layout)

`${CLAUDE_PLUGIN_ROOT}/templates/manifest.json` → `v1` lists every rename.

**Never filled** (every v1 file still the template, `CLAUDE.md` too): nothing to carry over. With
the developer's OK, `git rm` the v1 files, scaffold v2 fresh (step 2), and run the intake.

| v1 | v2 | How |
| --- | --- | --- |
| `project-overview.md`, `code-standards.md`, `security-rules.md`, `library-docs.md` | `overview.md`, `standards.md`, `security.md`, `libraries.md` | Rename. Add the v2 template's missing sections (e.g. Testing in `standards.md`) as placeholders |
| No `security-rules.md` (set up before it existed) | `security.md` | Copy the template, then audit it as in [intake-existing.md](intake-existing.md) Phase 5 (`security.md` bullet), read-only. A secret ever committed → tell the developer at once: rotate it first |
| `ui-tokens.md`, `ui-rules.md`, `ui-registry.md` | `ui/tokens.md`, `ui/rules.md`, `ui/registry.md` | Rename |
| `build-plan.md` + `progress-tracker.md` | `roadmap.md` | Merge, below |
| `plans/<feature>.md` | `specs/NNN-<feature>.md` | Rename, numbered in build order. Add `Status: Approved` if built, `Draft` if not |
| `designs/`, `contracts.md`, `known-issues.md` | same | Keep |
| `README.md`, `intake-guide.md`, `intake-existing.md`, `CLAUDE.template.md` inside `context/` | — | Delete: kit scaffolding, now in the plugin. Keep any of them the developer edited into project content, and say so |
| `memory.md` (root) | `context/session.md` | Rewrite in save-session's format, delete `memory.md`. In `.gitignore`, replace the `memory.md` line with `context/session.md` |

**Roadmap merge.** Start from the v2 `roadmap.md` template:

- **Status:** Now / Next from the tracker's Current Status. Depth tier: ask, recommending
  Prototype for unbuilt projects and Alpha for ones with screens shipped.
- **Principle:** from the build plan's principle line.
- **Slices:** one row per build-plan feature, in the same phases and numbers. Status from the
  tracker: checked → `done`, the current one → `doing`, the rest `todo`. Spec column links the
  migrated `specs/` file when one exists. Notes: one line.
- **Decisions and notes:** the tracker's "Decisions Made During Build", newest first.
- Per-feature detail longer than a line ("UI to build", "logic to wire") goes in a final section,
  `## Slice detail (from v1 build plan)`, verbatim, so nothing is lost. `plan-roadmap` trims it
  later.

**Path references.** `grep -rn` every old file name across `context/`, `CLAUDE.md`, `AGENTS.md`
and `.claude/`, and update each one. Files moved into `ui/` sit one level deeper: fix their
relative links (`../DESIGN.md` → `../../DESIGN.md`). Links to Helpers files outside the project
(`../add-security-rules.md`, the intake guides) point at nothing now: drop them.

**v1 `CLAUDE.md`** (the Helpers template, filled or not). Split it:

| v1 section | Goes to |
| --- | --- |
| Project name, Commands | `AGENTS.md`: title, Commands |
| "Context: read before any work" | Dropped: `AGENTS.md` → Where things are covers it |
| Design: ownership table, rules, taste dials, lint and export commands | `CLAUDE.md` → the v2 Design section, plus only what's specific to this project (dial values that were set, the export command). Unset dials are dropped; `design-flow` asks for them |
| Workflow per screen | Dropped. The skills carry the workflow: `/architect` → `write-spec`, `/imprint` → `capture-ui`, `/review` → `review-change`, `/recover` → `diagnose-problem`, `/remember` → `save-session`, progress-tracker updates → `sync-context` |
| Models: project specifics | `CLAUDE.md` → Models for this project |
| Compact instructions | `CLAUDE.md`, as is |
| Absolute paths into a v1 Helpers folder | Replace with the kit's equivalent or drop |
| Lines a kit rule already covers (no AI attribution in commits, model routing by phase) | Dropped: the rules load globally |

Then `CLAUDE.md` is the v2 template with those values in: `@AGENTS.md` first. Local mode: the
same content goes into `CLAUDE.local.md`, and the tracked `CLAUDE.md` is never touched.

**Leftovers from the "add to existing project" runbook** (local installs only): copies of the
old skills in `.claude/skills/{architect,imprint,review,recover,remember,find-docs}/` and a
`# >>> personal claude context` block in `.git/info/exclude`. After approval, delete the skill
copies and replace the block with the paths SKILL.md step 2 lists for local mode.

Finish: write or update `.pantoo.json` with `"layout": 2`, then resume the intake (SKILL.md
step 3) at the first file that still has placeholders.

## Security rules

When `context/security.md` has an older `Rules: vN` line than the kit's template (no line is v1).
The rules text is the kit's; the Project mapping is the project's. Only the first is replaced.

1. Show the plan in one message: the rules text replaced, the new mapping rows, the rules whose
   text was extended (v1 → v2: 5, 6, 8, 14, 18). Wait for approval.
2. Replace everything above `## Project mapping` with the template's, `Rules:` line included.
   Leave out the template's GUIDANCE lines when the project had already removed them. A trigger
   row or note the project added (not in the kit's text) is kept: name it and ask where it goes.
3. In the mapping, keep every row exactly as it is, with one exception: rule 18's name becomes
   "Security headers and production config". Append a row per new rule with How `not audited
   yet`, Where `—`, Status `todo`.
4. Tell the developer: the filled rows of the extended rules predate their new parts, and the new
   rows are unaudited; `/pantoo:review-change release` audits both. Add a `todo` slice or a
   `known-issues.md` entry for that audit only if they ask.

## Other instruction files

Found during any mode. They're prior developer statements: in the existing-project intake,
confirm each against the code like any other finding.

| File | What to do |
| --- | --- |
| Hand-written `CLAUDE.md` | Sort each paragraph: description and commands → `AGENTS.md`; conventions → `standards.md`; structure, stack, invariants → `architecture.md`; security notes → `security.md`; Claude-only instructions → stay in `CLAUDE.md`. Show the mapping, get approval, then rewrite `CLAUDE.md` as `@AGENTS.md` + the Claude-only part. Local mode: leave it untouched |
| Existing `AGENTS.md` | Keep its content, rearranged into the template's sections; detail longer than the index moves into the matching `context/` file |
| `.cursorrules`, `.cursor/rules/`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md` | Harvest. Don't delete them: teammates' tools read them. Recommend replacing their body with "Read AGENTS.md and the context/ files it lists", and ask |
| jsm layout: `docs/specs/`, `docs/scope/`, `docs/reviews/` | `context/specs/`, `context/roadmap.md`, `context/reviews/` |
| `.claude/rules/*.md` | Team rules if tracked: cite them from `context/`, don't copy. Untracked and personal: leave |

## Later layouts

When the kit changes the layout, a `## vN → vN+1` section is added here with its renames, and
`manifest.json` → `layout` goes up. `npx pantoo-ai doctor` compares the project's `.pantoo.json`
layout with the kit's and points here. Content the developer wrote is never replaced by a newer
template: only structure moves.
