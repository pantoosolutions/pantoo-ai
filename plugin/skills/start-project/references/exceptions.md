# Exceptions to global rules

Some projects need one of the developer's global rules relaxed, such as e2e runs they would
otherwise be asked about every time. Ask once, at the end of the intake:

> Does this project need a global rule relaxed? For example, running Playwright e2e on the local
> build without asking each time. Recommended: no, unless the project's checks need it often.

Take only what the developer names. Never propose relaxing more, and never infer a yes from the
code, the docs or a config file.

**No:** delete the whole "Exceptions to global rules" section from `CLAUDE.md` (`CLAUDE.local.md`
when local).

**Yes:**

1. In that section, replace `{{EXCEPTIONS}}` with one row per exception:
   - **Global rule:** the rule's file or name.
   - **Allowed here:** the exact action and its limit ("`npm run e2e` against the local build"),
     plus what still needs a yes.
   - **Why:** the developer's reason.
2. The row is what relaxes the rule. When a command would also stop at a permission prompt, show
   the exact `permissions.allow` lines and offer to add them to `.claude/settings.local.json`.
   Use the narrowest pattern that covers the action, never a bare `Bash` or a wildcard on `npx`,
   `node` or a shell.
3. Only after a yes to those lines:
   - If `git ls-files .claude/settings.local.json` prints the file, don't edit it. Give the
     developer the lines.
   - Otherwise add them, keeping every existing key.
   - If `git check-ignore -q .claude/settings.local.json` then fails, add that path to
     `$(git rev-parse --git-path info/exclude)`.

Permissions never go in `.claude/settings.json`, which teammates get.
