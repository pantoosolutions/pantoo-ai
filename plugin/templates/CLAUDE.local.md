# {{PROJECT_NAME}}: personal context

This file, `context/` and `.pantoo.json` are local to this clone (listed in `.git/info/exclude`),
never committed. The tracked `CLAUDE.md`, `AGENTS.md` and `.claude/rules/` are the team's rules
and win over anything here. Outside those local files, change only what the task is meant to
change for the team.

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
| `context/known-issues.md` | Debt and deviations; read before copying a pattern |
| `context/specs/` | One spec per load-bearing decision |
| `context/reviews/` | Verify and review reports |

## Compact instructions

When compacting, keep: the current task and its spec or plan path, decisions made and why, files
changed, failing checks with their exact errors, and open questions. Drop exploration output and
superseded attempts.

<!-- UI projects only: keep the section below, otherwise delete it. -->

## Design

Read `context/ui/tokens.md`, `context/ui/rules.md` and `context/ui/registry.md` before any UI
work, plus `DESIGN.md` and `PRODUCT.md` if they exist. Match the screens already built; don't
restyle screens the task didn't touch. Record new components with `capture-ui`.
Which design tool runs at which step: `design-flow`.
