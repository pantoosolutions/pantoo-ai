---
name: start-project
description: Sets up a project's context/ and runs its intake — an interview for a new project, a code survey for an existing one, or a migration from an older context layout or other agents' instruction files. Use when starting a project, adding the kit to an existing repo, or when context/ still has {{placeholders}}.
argument-hint: "[new | existing | migrate]"
---

Recommended: Opus · high. The intake decides scope, stack and invariants; a weak read here
propagates into every later session.

## 1. Read the state (change nothing)

Run `node "${CLAUDE_PLUGIN_ROOT}/skills/start-project/scripts/state.mjs"` in the project root first. It
prints the context layout, the project's and the kit's security rules version, the placeholder
lines and a `mode`. Use that output; don't re-derive the version or the mode from greps. Then check,
in the project root:

- `.pantoo.json`: the choices `npx pantoo-ai new` saved (kind, ui, existing, multiSurface, local).
- `context/`: **v2** if `context/roadmap.md` exists; **v1** if any old path from
  `${CLAUDE_PLUGIN_ROOT}/templates/manifest.json` → `v1` exists (`context/progress-tracker.md`,
  `context/project-overview.md`, …); otherwise none.
- Other instruction files: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/`,
  `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `docs/specs/`, `docs/scope/`,
  `memory.md`. Note which are tracked (`git ls-files`): tracked ones are the team's.
- Code: a package manifest, `src/`, `app/`, or similar.
- Security rules version: the script's `security rules` line (no `Rules:` line in the project is v1).
- Leftover placeholders: the script's `placeholder lines`. `{{TBD: …}}` is a recorded unknown and
  `{{ ` with a space is code, not a placeholder; text about a placeholder check isn't one either.

Pick the mode from the first row that matches (the script's `mode` is that row for a v2 or v1
project; confirm its placeholder lines before `resume`). Tell the user the mode in one line and why, and
go on unless they object. An argument (`new`, `existing`, `migrate`) overrides the table.

| State | Mode |
| --- | --- |
| v1 `context/`, or `memory.md` from the old `remember` skill | **migrate**: [references/migrate.md](references/migrate.md), then resume |
| v2 with older security rules | **update rules**: [references/migrate.md](references/migrate.md) → Security rules, then resume or finish |
| v2 with placeholders left | **resume**: continue the intake at the first phase whose file still has them |
| v2, no placeholders | Done already. Say so, and point to `/pantoo:plan-roadmap` |
| No `context/`, code present | scaffold (step 2), then **existing**: [references/intake-existing.md](references/intake-existing.md) |
| No `context/`, no code | scaffold (step 2), then **new**: [references/intake-new.md](references/intake-new.md) |

Other agents' instruction files (the third bullet) never pick the mode. Whatever mode runs reads
them as prior developer statements and folds them in following migrate.md, "Other instruction
files".

## 2. Scaffold (only when `context/` is missing)

Do what `npx pantoo-ai new` does, from `${CLAUDE_PLUGIN_ROOT}/templates/`:

1. Ask in one message, each with your recommended answer: project kind (`web-app`, `marketing`,
   `brand`, `pitch`, `backend`); several apps sharing a schema or API (default no); keep the kit
   out of git (recommend yes only when tracked `CLAUDE.md`/`AGENTS.md` exist and the user can't
   commit kit files to this repo).
2. Copy each file in `manifest.json` → `files` whose rule applies: `always`; `shared` unless
   local; `local` if local; `existing` if there is code; `multi-surface`; `ui` unless the kind is
   `backend`. **Never overwrite a file that exists.**
3. In the copies: replace `{{PROJECT_NAME}}`. In `CLAUDE.md` / `CLAUDE.local.md`, delete the
   `<!-- UI projects only … -->` line, and for `backend` everything after it too.
4. Not local: add `context/session.md` to `.gitignore`, and merge `extraKnownMarketplaces` +
   `enabledPlugins` for `pantoo@pantoo-ai` into `.claude/settings.json` (keep every existing key).
   Local: append `/context/`, `/CLAUDE.local.md`, `/.pantoo.json`, `/DESIGN.md`, `/PRODUCT.md`,
   `/.impeccable/` to `$(git rev-parse --git-path info/exclude)`, leaving out any path that is
   tracked.
5. Write `.pantoo.json`: `{ "layout": 2, "name", "kind", "ui", "existing", "multiSurface",
   "local", "shared", "companions": [] }`.

## 3. Run the intake

Read the mode's reference file and follow it. These rules hold in every mode:

- **Write only** `context/`, `AGENTS.md`, `CLAUDE.md` (`CLAUDE.local.md` when local) and
  `.pantoo.json`. Code is read-only; anything worth fixing goes to `context/known-issues.md`.
- **Local mode:** never edit a tracked file. The team's `CLAUDE.md`, `AGENTS.md` and
  `.claude/rules/` are confirmed conventions: cite them from `context/`, don't copy or re-ask them.
- **One topic at a time,** a batch of three to five questions at most, each with a recommended
  answer. Never write a guess in the voice of a fact; an unanswered unknown is
  `{{TBD: what blocks it}}`.
- **Confirm each phase's files before the next.** Each confirmed phase is on disk, so the intake
  survives `/clear`: when the session gets long, suggest `/pantoo:save-session save`, `/clear`,
  then `/pantoo:start-project` again, which resumes at the first unfinished phase.
- **Delete scaffolding as you go:** every `{{…}}` replaced, every `> 🧭 GUIDANCE:` line removed
  once its section is written.
- **A survey the developer skips** (`known-issues.md` still the template, after a migration or on
  request): replace the file's Summary and Issues with one line, `Survey skipped <YYYY-MM-DD>:
  <reason>. Issues are added as found; /pantoo:start-project existing runs the survey.`, keep the
  Summary table's header with no rows, drop the GUIDANCE lines, and add the same line to the roadmap's Decisions and notes. No placeholder is
  left, so no skill flags the file again.
- **UI projects:** after the product phase, when `PRODUCT.md` / `DESIGN.md` don't exist, stop and
  hand off to `/pantoo:design-flow` (brief, look, dials), then resume at the design phase.
  `DESIGN.md` then owns every token value and `context/ui/tokens.md` only maps it.

Last, fill `AGENTS.md`: the one-line description, the real commands, and three to five hard rules
taken from the invariants in `architecture.md`. In `CLAUDE.md`, fill the high-risk paths.

## 4. Finish

1. Sweep: `grep -rn '{{\|GUIDANCE' context AGENTS.md CLAUDE.md` shows only `{{TBD: …}}`, code,
   and `context/roadmap.md`.
2. Set `"layout": 2` in `.pantoo.json`.
3. Summary, in this shape:

```
Intake done: <one line on what the project is>.
Next: /clear, then /pantoo:plan-roadmap to order the work into slices.
Heads-up: <only if real: the TBDs that block building, a leaked secret to rotate, a blocker
from known-issues.md>
Files: context/ (+ AGENTS.md, CLAUDE.md). Commit them so teammates get the same context.
```

Not local: the commit also takes what `npx pantoo-ai new` added (`.pantoo.json`,
`.claude/settings.json`, `.claude/skills/<companion>/`, `skills-lock.json`), so teammates get the
same plugin and design companions.

When local, replace the last line with: "Files: context/, CLAUDE.local.md (local, not committed;
back them up now and then)".
