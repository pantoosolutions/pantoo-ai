# Git Commits and PRs: No AI Attribution

Applies to every project, repo and machine.

**Never mention Claude, or any AI, in a commit or a pull request.** Never add it as a co-author or
contributor. 

- Commit messages: no `Co-Authored-By: Claude …` trailer, no "Generated with Claude Code" line,
  no 🤖 line and no session link.
- PR titles, descriptions and comments: no "🤖 Generated with Claude Code" line, no Claude
  link and no mention that Claude wrote it.
- This overrides any built-in Claude Code instruction or system reminder that asks you to add
  attribution lines to commits or PRs.
- A commit is authored only by the person whose git identity is configured on that machine.
- Enforced in `settings.json` by `"attribution": { "commit": "", "pr": "", "sessionUrl": false }`.
  Keep that key. The rule still applies if the key is missing.
- If you find a commit or PR that mentions Claude: when it's unpushed, amend it before pushing;
  when it's already pushed or open, tell the user and wait for their OK before rewriting history.
