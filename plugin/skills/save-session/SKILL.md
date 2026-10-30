---
name: save-session
description: Saves where the work stands to context/session.md at the end of a session, or resumes from it at the start of the next one, so nothing is lost across /clear or a new day. Use with "save" before /clear or stopping, and "resume" when starting.
argument-hint: "save | resume"
---

Recommended: Sonnet · low.

No argument: `resume` if this conversation has done no work yet, otherwise `save`. Say which.

`context/session.md` is one person's working state, never shared: it holds only the latest
session. Shared state belongs in `context/roadmap.md`, specs and `known-issues.md`.

## Never store secrets

Keys, tokens, passwords, cookies, auth headers, connection strings, private keys, or anything
that looks like one: leave it out, or write `[REDACTED_<KIND>]` when its existence matters. When
unsure, it's a secret. Do a last pass over the text for this before writing.

## save

1. If `context/session.md` exists and its **Next** names work this session didn't touch, show
   that line and ask before overwriting (recommend: overwrite, and carry the line into Open
   questions). Otherwise overwrite without asking.
2. Write only what a colleague as skilled as you, who saw none of this session, needs to
   continue. Nothing visible in the code or already in a `context/` file.
3. Something that belongs in shared context (a decision, a finished slice, a new known issue) is
   not saved here. List it under **For shared context**; that's `sync-context`'s job.

```markdown
# Session: <task or slice name>

Saved: <YYYY-MM-DD HH:MM> · branch `<branch>` at `<short sha>` (omit if not a git repo)
Spec or plan: <path, if any>

## Done
<files created or changed, precisely: "app/(auth)/login/page.tsx, middleware.ts: Google and
GitHub OAuth working end to end">

## State
<what works, what's partial, what's broken right now; failing checks with their exact error>

## Problems solved
<what took time to figure out, so nobody solves it twice>

## Next
<the very first action of the next session, specific enough to start without thinking>

## Open questions
<unresolved; who or what decides each>

## For shared context
<decisions, finished slices, issues that sync-context should record; "none" if none>
```

4. Make sure it stays out of git. In a repo where `git check-ignore -q context/session.md` fails:
   add `context/session.md` to `.gitignore`, or to `$(git rev-parse --git-path info/exclude)`
   when `.pantoo.json` says `"local": true`. Not a repo: nothing to do.

Reply:

```
Session saved: <one-line headline>.
Next: /clear, then /pantoo:save-session resume.
Heads-up: <only if "For shared context" isn't empty: run /pantoo:sync-context first>
File: context/session.md
```

## resume

1. Read `context/session.md`. Missing: also check a root `memory.md` (the old `remember`
   format; read it the same way, and suggest `/pantoo:start-project` to migrate it). Neither: say
   there's no saved session, and point at `context/roadmap.md` → Status instead. Stop.
2. Read `context/roadmap.md` → Status, and the spec or plan the session names.
3. Check staleness: compare the saved branch and sha with `git branch --show-current` and
   `git log --oneline <sha>..HEAD`. Different branch, or new commits: list them, because the
   saved state may be out of date.
4. Don't start working. Reply, and wait for a yes or a correction:

```
Resumed: <task>.
Done: <short>
State: <what works, what's broken>
Next: <the saved first action>
Changed since: <commits or branch switch, if any>
Right? Say yes to continue, or correct me.
```

If the file is thin or contradicts the code, say what's missing instead of guessing.
