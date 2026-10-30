---
name: write-docs
description: Writes a PR description, a changelog entry, release notes or a blameless postmortem from the real record (commits, diff, specs, reviews, and the developer's account of an incident), never from memory. Opens or updates a PR with gh only after showing the text and asking. Use before opening a PR, when releasing, after an incident, and as the last step of a GA slice.
argument-hint: "pr | changelog | release-note | postmortem"
---

Recommended: Sonnet · low; Sonnet · medium for a postmortem.

Every sentence traces to a commit, a diff hunk, a spec, a review or a fact the developer gave. Never
invent a change, a cause or a timeline entry. Pitch each document at the people who act on it.

## 1. Type

An argument → that type. Otherwise infer one and ask, recommending it: a branch ahead of the base →
`pr`; a version just tagged → `release-note`; a `diagnose-problem` fix for something users hit →
`postmortem`; otherwise `changelog`.

| Type | Source | Reader | Lands in |
| --- | --- | --- | --- |
| `pr` | the branch's commits and diff against the base | reviewers | the chat; `gh pr create` or `gh pr edit` on a yes |
| `changelog` | the merged or branch change | developers | `CHANGELOG.md`, under the unreleased section |
| `release-note` | a tag range | end users | `docs/releases/<version>.md` |
| `postmortem` | the incident, as told by the developer, plus the fix | the team | `docs/postmortems/<YYYY-MM-DD>-<slug>.md` |

A project that already keeps these somewhere else → follow it.

## 2. Gather

- Base: `main` if it exists, else `master`. `git log --oneline <base>..HEAD` and
  `git diff --stat <base>...HEAD`, then read the diff itself. More than ~25 files → the `Explore`
  agent summarises it by area first.
- The why: the slice's spec (down to `## Record`), its reviews in `context/reviews/`, and the roadmap's
  Decisions and notes for this slice.
- `release-note`: `git tag --sort=-creatordate`; the range is the last two tags. No tags → ask for the
  version and the range; never guess.
- `postmortem`: ask for what git can't hold, in one batch: what broke, when (with timezone), who was
  affected and how, how it was detected, what fixed it. Missing answers stay `{{TBD}}`.
- `pr`: `gh` installed, a remote (`git remote`), and an open PR (`gh pr view --json number`) decide
  between create, edit, or chat only.

## 3. Write

Read only the matching section of [references/templates.md](references/templates.md).

- `changelog`: match the file's existing format; Keep a Changelog only for a new file. Add, never
  rewrite released entries.
- No mention of Claude or any AI, and no attribution line, in PR text or commits.
- `pr`: show the full title and body in the chat first. Then ask before `gh pr create` or
  `gh pr edit`, and before any push; never push or open a PR unasked.

## Finish

GA slice and this is its last step → offer to mark it `done` and move **Now** and **Next**.

```
<Type> written: <PR #N created | PR #N updated | text below | path>.
Next: <the obvious one: open the PR | commit the changelog | mark the slice done | share the postmortem>.
Heads-up: <only if real: {{TBD}} facts missing from a postmortem, commits with no clear purpose>
File: <path, or "chat only">
```
