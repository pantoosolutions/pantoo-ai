# Changelog

## 0.8.0

First public release, on GitHub and npm.

- `npx pantoo-ai update` checks npm first and, when a newer CLI is out, runs the update with it, so a
  cached `npx` copy never applies an old kit. Skipped from a git clone, with `--no-self-update`, or
  offline (with a warning).
- `doctor` warns when the `pantoo-ai` marketplace is a local folder (dev mode: every project runs
  that clone's checked-out branch) and gives the fix. Test kit changes with `claude --plugin-dir`.
- `--version` prints the CLI's version.
- README and SECURITY.md. CI actions pinned to commit SHAs, with Dependabot keeping them current.

Fixed, from the release review:

- The commit guard ran nothing when its path went through a symlink (a symlinked `~/.claude`,
  `/home` → `/var/home`, Windows junctions). The guard and `start-project`'s state script now compare
  real paths.
- `remove` only unmerges the settings `init` added, so a value you already had is kept. Installs from
  before 0.8.0 keep the old behaviour. It deletes recorded files only inside the Claude folder, so a
  crafted `.pantoo.json` in a cloned repo can't point it elsewhere.
- `doctor` leaves a `machine.md` it didn't write alone, and warns. `remove` deletes the kit's copy.
- `update` ignores a malformed version from the registry, and falls back to the local update when
  `npx` can't run.

## 0.7.5 (unreleased)

- `machine.md` gives the command that loads the detected Node manager's environment (fnm, nvm, asdf)
  for each shell on the machine, and on Windows warns that PowerShell 5.1 writes UTF-8 with a BOM.
- The CLI reads JSON files that start with a BOM.

## 0.7.4 (unreleased)

- Line endings don't count as an edit: `doctor`, `init` and `update` compare kit files and their
  recorded hashes with CRLF normalised to LF, so a Windows clone (`core.autocrlf`) no longer reports
  an unedited rule as "edited by you", and `update` refreshes it instead of keeping it. Installed
  copies are written with LF. `.gitattributes` checks the kit out with LF on every OS.

## 0.7.3 (unreleased)

- `doctor` and `start-project` share one placeholder pattern: `{{NAME}}` closed on the same line.
  Text that only mentions `{{` (a rule about the placeholder check) no longer counts as unfilled.

## 0.7.2 (unreleased)

- `start-project` reads the project's state with a script (`skills/start-project/scripts/state.mjs`)
  instead of model-run greps: context layout, the project's and the kit's security rules version,
  placeholder lines and the mode. A `security.md` with no `Rules:` line is v1 and gets `update
  rules`; it was once mistaken for the template's version and reported as done.

## 0.7.0 (unreleased)

- Design sources: `context/designs/README.md` gets a Sources table (tool, way, location, version,
  last synced, owner). `design-flow` reads each source by how it was handed over (token file, code,
  live tool over MCP, link, files) and gains `sync`, which re-reads them and asks about every
  difference before `DESIGN.md` changes.
- `plugin/design-sources.json`: known design tools (Figma, Penpot, Sketch, Webflow, Canva, Framer,
  Google Stitch, Claude Design, Claude artifacts) with their official MCP server, sign-in, read and
  write tools and export quirks, checked against vendor docs on 2026-10-28.
- `npx pantoo-ai add source <tool>` and `new --source <tool>` write the tool's MCP server into
  `.mcp.json` and record the source. `doctor` checks every MCP source has a committed server entry,
  and fails a `.mcp.json` with a literal key in a header, secret env value or URL.
- `web-access` rule: design data from a tool with no CLI goes through its official MCP server.
- Security rules v2 (OWASP Top 10:2025): rules 21–25 (input-chosen destinations, fail closed,
  security logging and alerting, build and deploy pipeline, AI input and output); rules 5, 6, 8,
  14 and 18 extended; an OWASP tag on every rule; new trigger rows. `security.md` carries a
  `Rules: v2` line.
- `doctor` flags a project whose `security.md` has older rules; `start-project` updates the rules
  text, keeps every filled mapping row, and adds the new rows as `todo`.
- `write-spec` adds abuse cases, each stopped by an AC, when a slice touches auth, payments,
  personal data, uploads or AI calls. `verify-feature` exercises those ACs as the abuse.
- `review-change release` checks every rule and reports evidence for `todo` mapping rows, then
  offers to update the mapping.

## 0.6.1 (unreleased)

- `start-project` commits what `npx pantoo-ai new` added (`.pantoo.json`, `.claude/settings.json`,
  companion skills, `skills-lock.json`) together with the context, so teammates get the same plugin
  and companions.

## 0.6.0 (unreleased)

- `verify-feature` sets up Playwright the first time from a new reference, `browser-checks.md`
  (screen projects, passwordless sign-in, scratch checks, gotchas).
- `start-project` migration: a v1 scaffold that was never filled is replaced by a fresh v2 one,
  and a v1 project without `security-rules.md` gets `security.md` plus a read-only audit.
- `doctor` also flags a leftover `find-docs` skill.
- `docs/model-and-token-playbook.md` (the reasoning behind the model and token rule) and
  `docs/multi-surface-intake.md` (a worked intake on a multi-repo system).

## 0.5.0 (unreleased)

- `doctor` detects the machine (OS, arch, Node manager, working Python command, Homebrew prefix, Git
  Bash on Windows) and writes `~/.claude/rules/machine.md` from it. It warns about the hand-written
  `mac-dev-environment.md` / `windows-dev-environment.md` it replaces, and fails on Windows when Git
  Bash is missing.
- `init` / `update` set `env.CLAUDE_CODE_GIT_BASH_PATH` in user settings on Windows (kept if already
  set); never in project settings.
- On Windows, `claude` and `npx` run through the shell as one quoted command string, so `.cmd`
  shims resolve, paths with spaces survive and Node's DEP0190 warning is gone.
- `--marketplace <local path>` is passed to `claude` as an absolute path (it rejects `.`).
- `doctor` compares only the kit's own settings keys, so an extra `env` key isn't a difference.
- `plugin.json`: `userConfig.commit_guard` drops `options`, which Claude Code 2.1.177 rejects.
- Claude Code without `plugin configure` (2.1.177): the guard stays at its default, block; only
  warn or off fail, with a pointer to `claude update`.

## 0.4.0 (unreleased)

- Skills: `write-tests` (framework from `standards.md`, asked and saved on the first run; tests
  traced to ACs; never edits application code), `write-docs` (PR, changelog, release note,
  postmortem, from the real record; `gh` only after asking), `capture-ui` (registry entries by
  token role; `audit` sets a confirmed baseline) and `design-flow` (which design tool at which step,
  file ownership, taste dials).
- Hooks: a commit guard (PreToolUse on Bash: `git commit`, `gh pr create|edit|comment`; block, warn
  or off through the plugin's `commit_guard` option, default block) and a SessionStart reminder to
  resume when `context/session.md` exists. Both are Node scripts, so they run on Windows without
  Git Bash.
- Third-party design tools pinned in `third-party.json` (impeccable 4.8.0, taste v2.1.5,
  ui-ux-pro-max v2.15.0, by commit SHA where the skills CLI installs them). `init` installs the
  design pack; `new` installs the project type's ui-ux-pro-max companions into the project's
  `.claude/skills/` (committed).
- CLI: `init --scope project`, `--guard`, `--no-design`; `add`, `update` and `remove`; `doctor`
  checks the guard, the pins, the companions, and companions left installed globally.
- `npm run check` (`scripts/check-skills.mjs`): frontmatter, verb-noun names, no model pins, size
  budgets, links, machine-specific paths, version agreement, hooks. CI runs it with the tests on
  Ubuntu and Windows.
- `docs/design-runbook.md`. `start-project` hands UI projects to `design-flow` and records a
  skipped survey as a decision, so other skills stop flagging `known-issues.md`.
  `verify-feature` hands off to `write-tests` at Beta and GA.

## 0.3.0 (unreleased)

- Core loop skills: `plan-roadmap` (plan, status, replan, add), `write-spec` (interview, value
  sourcing, approval gate, ratifying Assumed specs), `build-feature` (spec gate with a coverage
  test, Assumed escape hatch, resume from the build plan), `verify-feature` (runs the real app,
  evidence-gated verdict per acceptance criterion, refactor before/after mode), `review-change`
  (three layers on a model that didn't write the code), `sync-context` (surgical, idempotent
  context updates) and `diagnose-problem` (bug, reset or rethink).
- Spec template (`write-spec/references/spec-template.md`): build sections first, decision record
  last; statuses Draft, Approved, Assumed, Superseded.
- Roadmap template: `dropped` status, `needed` in the Spec column, per-slice tier tag in Notes.
- From the acceptance run:
  - `verify-feature` runs the build and the full suite first. It checks that every name the diff
    references resolves in generated output. It reads a slice's own tests before trusting them,
    and copies evidence from the ledger.
  - `build-feature` makes each new guard test fail once before trusting it.
  - `write-spec` runs the cross-model check before approval and rewrites the slice's Notes on
    approval.
  - `diagnose-problem` asks before touching local data and never commits unasked.
  - `plan-roadmap` caps the length of Notes.

## 0.2.0 (unreleased)

- `npx pantoo-ai new`: scaffolds context v2 (never overwrites; leaves a v1 `context/` for migration),
  shares the plugin through `.claude/settings.json`, `--local` for repos you can't commit to, and
  writes `.pantoo.json`.
- `doctor` checks the project in the current folder: layout, intake placeholders, sharing, session file.
- Skills: `start-project` (new, existing, migrate) and `save-session`.
- Templates moved into the plugin (`plugin/templates/`) with a `manifest.json`; `standards.md` gains a
  Testing section; `CLAUDE.local.md` template for local mode.

## 0.1.0 (unreleased)

- Skeleton: plugin and marketplace manifests, four agents, context v2 templates, core rules,
  settings snippet, `init` and `doctor` (user scope).
