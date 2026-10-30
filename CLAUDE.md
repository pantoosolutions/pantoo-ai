# pantoo-ai

A kit for Claude Code: the `pantoo` plugin (skills, agents, hooks), context templates, rules, settings
and the `npx pantoo-ai` installer CLI. Public, MIT. See `README.md`.

- English. A dev kit for any project: nothing about a company, its clients or anyone's machine goes in
  this repo (no names, no local paths).
- Skills follow `docs/authoring.md`: verb-noun names, every line changes behavior, one recommended
  option per question. `npm run check` before committing.
- Test kit changes with `claude --plugin-dir ./plugin`, never by pointing the installed marketplace at
  this clone.
- A release bumps `version` in both `package.json` and `plugin/.claude-plugin/plugin.json`, with a
  `CHANGELOG.md` entry. Installed plugins auto-update on a bump.
- Never mention Claude or any AI in commits or PRs (`rules/git-commits.md`).
- Planning and skill design: Opus · high. CLI plumbing, moving files, templates: Sonnet · medium.
