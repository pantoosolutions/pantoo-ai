# Security

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/pantoosolutions/pantoo-ai/security/advisories/new),
not in a public issue. Include the version (`npx pantoo-ai --version`), your OS and the steps to
reproduce. We aim to reply within a week.

The kit runs on your machine with your permissions: the CLI edits `~/.claude/` and project settings
(with a backup first), and the plugin's hooks run on `git commit`, `gh pr create` and session start.
Reports about any of these are in scope.
