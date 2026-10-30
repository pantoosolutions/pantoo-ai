# Refactor mode: before and after

For a change that must not alter behaviour. "Works" means the outputs are identical before and
after. This is the safety net when the project has no test suite.

Run it in an Agent (`model: sonnet`, tools to run the app and read files) so the two sets of
outputs stay out of the main context. Brief it with the steps below, the base ref and the surfaces.

1. **Surfaces.** From the diff, pick the endpoints, queries, jobs, pages or commands the change
   reaches, one or two per changed area, favouring output that would show a shift.
2. **Before.** `git worktree add <tmp-dir> <ref before the change>`, start the app there on its
   own port, hit each surface, save the raw outputs, then `git worktree remove <tmp-dir>`. No
   worktree possible → `git stash --include-untracked`, capture, `git stash pop`, and only after
   the developer says yes, since it touches their working tree.
3. **After.** Start the app on the current tree and hit the same surfaces the same way.
4. **Diff** each surface. Any difference that isn't documented as intended is a regression.

Write the report in the usual place and shape, with this table instead of the AC table:

| Surface | Before = after | Difference |
| --- | --- | --- |

Verdict: PASS when every surface matches; FAIL with the exact diff otherwise →
`/pantoo:diagnose-problem`.
