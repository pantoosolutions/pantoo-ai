# Model, Effort and Token Strategy

Applies to every session. The goal is the best result for the least plan usage. Quality comes
first: save tokens by cutting waste, never by skimping on thinking a task needs. The reasoning is
in `docs/model-and-token-playbook.md` in the pantoo-ai repo.

Cost order: Haiku (about 1/20 of Sonnet) < Sonnet < Opus (about 2x Sonnet). The biggest savings
come from small context and from sending reading-heavy work to Haiku, not from avoiding Opus.
Never switch to a model that bills outside the user's plan without their explicit OK.

## Route by phase

| Work | Main model · effort |
| --- | --- |
| Intake, overview, architecture, roadmap, choosing between approaches | Opus · high |
| First screens that set the visual language (landing, hero, app shell) | Opus · high |
| Design critique | Opus · high |
| Further screens that reuse the UI registry | Sonnet · medium |
| Wiring logic, CRUD, API routes, tests, audits, targeted fixes | Sonnet · medium |
| Progress updates, commits, renames, copy edits | Sonnet · low |
| Auth, payments, permissions, secrets, uploads, data migrations | Design on Opus · high; build on Sonnet · high |
| Bug fix | Sonnet · high; after two failed fixes, Opus · high |
| Pre-release review and the full security pass | `deep-reviewer` subagent (Opus · high) |

## What you do

### Choose the model for delegated work

Pass `model` on the Agent call when the default doesn't fit. Kit subagents:

- `Explore` (Haiku): any search or survey across more than about 3 files. Pass `model: "sonnet"`
  when the survey needs judgement, such as an architecture read of an unfamiliar repo.
- `docs-researcher` (Haiku): library and API docs, so doc dumps stay out of the main context.
  Run ctx7 yourself only for a one-line check.
- `verifier` (Haiku): build, typecheck, lint, tests, Playwright. Returns only failures.
- `implementer` (Sonnet): when you are on Opus and a plan is approved, hand it well-specified
  chunks with exact files and acceptance checks, then review what comes back.
- `deep-reviewer` (Opus): independent review before release, and for security-sensitive or
  client-facing changes.

A subagent starts with a cold cache, so do a single known read or one grep yourself instead of
delegating it.

### Tell the user when the main model doesn't fit

You can't switch your own model. When a task starts and the model clearly doesn't fit the phase,
say so in one line with the command, then carry on:

- Opus on routine build work: "This is routine build work. `/model sonnet` would use about half
  as much."
- Sonnet facing architecture, design direction, security design, or a bug that survived two
  fixes: "This needs deeper judgement. `/model opus` (after `/clear` if the context is
  unrelated)."

Say it once per task, never mid-task and never every turn. If the user declines, drop it. The
user decides; nothing here is enforced.

### Keep the cache warm

- A model switch drops the whole cache, so the next turn rereads everything uncached. Suggest
  switches only at task boundaries, ideally right after `/clear`.
- Changing effort keeps the cache. For more or less thinking, suggest `/effort <level>` rather
  than a model switch.
- Hand phases over through files. Write the approved plan to `context/`. The user runs `/clear`,
  switches model, and says "read <file> and build step 1".

### Keep context small

- Search before reading (Grep or Glob), then read only the range you need.
- Don't re-read a file you just edited, or one you already read that hasn't changed.
- Trim noisy commands: `| tail -40`, `grep -E 'error|fail|FAIL'`, `--silent`, `git diff --stat`
  before a full diff. Never dump full logs, lockfiles, build output or minified files.
- Prefer CLIs (`gh`, `vercel`, `supabase`) over MCP servers.
- Keep replies tight. Don't restate the plan or narrate diffs the user can already see.
- Once a feature is committed, suggest `/clear` before unrelated work.

### Escalate in this order

1. Missing context: read the right files, reproduce the error, get the exact message.
2. Raise effort.
3. Move up a model (Sonnet to Opus), at a boundary.

## Never economise on

- Security (auth, secrets, permissions, payments, uploads), data migrations, architecture
  decisions, and anything a client will see. Use at least Sonnet · high, design on Opus, and run
  `deep-reviewer` before release.
- Verification: run the check (through `verifier`) instead of assuming it passes.
