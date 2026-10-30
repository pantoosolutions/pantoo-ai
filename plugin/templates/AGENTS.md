# {{PROJECT_NAME}}

{{ONE_LINE_DESCRIPTION}}

## Commands

- Dev: `{{DEV_COMMAND}}`
- Build / typecheck: `{{BUILD_COMMAND}}`
- Test: `{{TEST_COMMAND}}`

## Hard rules

- {{HARD_RULE}}
- Scope is the current slice. Note adjacent problems; don't fix them unprompted.
- Check `context/security.md` when a task hits one of its triggers (keys, auth, database, endpoints,
  user input, uploads, logging, hosting, dependencies).

## Where things are

Read `context/roadmap.md` first, then whatever the task touches.

| File | Holds |
| ---- | ----- |
| `context/overview.md` | What this is, for whom, scope in and out |
| `context/architecture.md` | Stack, structure, data model, invariants |
| `context/standards.md` | Code conventions, testing |
| `context/security.md` | The security rules and when each applies |
| `context/libraries.md` | How this project uses each library |
| `context/roadmap.md` | Slices, depth tier, status, decisions |
| `context/specs/` | One spec per load-bearing decision |
| `context/reviews/` | Verify and review reports |
