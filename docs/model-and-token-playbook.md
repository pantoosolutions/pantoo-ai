# Model and token playbook: best output for the least usage

Which model and effort to use for each kind of work, and the habits that keep usage down without
lowering quality. Researched 2026-10-26 against the Claude Code docs (v2.1.294) and current model
pricing. The rule Claude follows is `rules/model-and-token-strategy.md` (installed to
`~/.claude/rules/` by `npx pantoo-ai init`). This file explains the reasoning behind it.

---

## 1. What the research says

| Finding | What it means for you |
| --- | --- |
| Opus 5.5 is $4/$20 per 1M tokens, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50, Fable 5.1 $10/$50 | Opus is only **~2x** Sonnet now. Haiku is **~20x cheaper** than Sonnet. Fable is 2.5x Opus |
| Every turn resends the whole conversation, read from cache | A long session costs usage on every message, even a one-liner. **Context size is the biggest lever** |
| **Switching model drops the cache.** The next turn rereads everything uncached | Switch only at task boundaries, ideally right after `/clear` |
| On 5.5 models, **changing effort keeps the cache** (subscription or API key) | Effort is the cheap knob mid-session. Model switching is the expensive one |
| Opus 5.5 at `medium` matches or beats Opus 5 at `high`. 5.5 models default to `medium` | `high` is for work where mistakes are expensive, not a blanket default |
| The built-in **Explore** subagent runs on **Opus** on a subscription | Every file search your session delegates may be billed at Opus rates. Override it to Haiku (see section 3) |
| Subagents inherit the main model unless told otherwise | Without a default, an Opus session makes Opus subagents for everything |
| The **advisor** (`/advisor opus`) lets Sonnet do the work and consult Opus at decision points | Opus judgement on plans, stuck errors and "done?" checks. But each call rereads the whole transcript **uncached** at Opus rates, and **subagents inherit it**, including the Haiku ones. Experimental. Use it per session, not as a global default |
| `opusplan` = Opus in plan mode, Sonnet otherwise. Each plan-mode toggle is a model switch | Good for feature planning. Plan mode can't write files, so not for the intake |
| Rules, skill descriptions and agent descriptions load **every turn**. Skill bodies load only when used | Keep `CLAUDE.md` under 200 lines and move workflows into skills |
| `/compact` is itself a large request. `/clear` costs nothing | Clear between unrelated tasks. Compact only when you need continuity |
| Fable bills to **usage credits** on your plan | Real money. Only for problems Opus at high couldn't crack, and only with your OK |

**Bottom line:** "Opus to architect, Sonnet to build" is right, but it's the smaller saving. The
bigger savings are small context, cheap models for reading and searching, and switching model only
at boundaries.

## 2. Which model for which work

Each skill states its own recommended model on its second line. This table matches them.

| Work | Model · effort | Why |
| --- | --- | --- |
| `/pantoo:start-project`, `/pantoo:plan-roadmap`, `/pantoo:write-spec` | **Opus · high** | Every later decision inherits them |
| First screens that set the look (landing, hero, app shell) | **Opus · high** | Taste matters most where the visual language is born |
| `/pantoo:design-flow` to set the look, and `impeccable critique` | **Opus · high** | Pure judgement |
| `/pantoo:build-feature` on later screens, wiring, CRUD, API routes | Sonnet · medium | Following an established system, well-specified work |
| `/pantoo:verify-feature`, `/pantoo:write-tests`, `impeccable audit` / `polish` | Sonnet · medium | Checklist-driven |
| `/pantoo:capture-ui`, `/pantoo:sync-context`, `/pantoo:save-session`, `/pantoo:write-docs`, commits | Sonnet · low | Mechanical or near-trivial |
| Auth, payments, permissions, secrets, uploads, migrations | Design: **Opus · high**. Build: Sonnet · high | Cost of error |
| `/pantoo:review-change` and pre-release review | **`deep-reviewer`** (Opus · high, fresh context) | Independent eyes and the full security pass |
| Bug fix | Sonnet · high → `/pantoo:diagnose-problem` → Opus · high → a pricier model, only with your OK | Escalate one step at a time |

**Escalation order when something is hard:** give better context → raise effort →
`/pantoo:diagnose-problem` → move up a model → a pricier model, with your OK.

## 3. What the kit sets up

`npx pantoo-ai init` installs the pieces below. `npx pantoo-ai doctor` checks that they are in place
and lists what's missing.

**Settings** (`settings/settings-snippet.json`, merged into `~/.claude/settings.json`)

| Setting | Value | Effect |
| --- | --- | --- |
| `env.CLAUDE_CODE_SUBAGENT_MODEL` | `sonnet` | Subagents with no model of their own run on Sonnet, not on an Opus session's model |
| `modelSettings` | Opus `high`, Sonnet `medium`, Haiku `medium` | Default effort per model. Lower it with `/effort` when the work is routine (keeps the cache) |
| `attribution` | empty commit and PR, no session URL | Commits and PRs carry no AI attribution |
| `extraKnownMarketplaces`, `enabledPlugins` | the `pantoo-ai` marketplace, the `pantoo` plugin | Installs the skills, agents and hooks, and keeps them updated |

Not set on purpose: `advisorModel`. There is no per-subagent off switch, so a global advisor would
add Opus calls to every Haiku search. Use `/advisor opus` for one long session with real decision
points, and `/advisor off` after. The setting is saved globally, so don't forget the `off`.

Your default `model` is your choice and isn't set by the kit. `sonnet` suits days spent mostly
building. `opus` gives Opus judgement throughout at about 2x the usage. Either way, switch at
boundaries.

**Agents**

| Agent | Model | Job |
| --- | --- | --- |
| `Explore` | Haiku | Overrides the built-in, which ran on Opus. Codebase search, conclusions only. Installed to `~/.claude/agents/` |
| `docs-researcher` | Haiku | ctx7 and web docs lookups. Doc dumps stay out of your session |
| `verifier` | Haiku | Build, typecheck, lint, tests, Playwright. Returns only failures |
| `implementer` | Sonnet | From an Opus session: builds an approved chunk of the plan |
| `deep-reviewer` | Opus | Independent pre-release and security review. Read-only |

The last four ship in the `pantoo` plugin. Agents from other tools that set `model: inherit` still
follow your session model.

**The rule**, `rules/model-and-token-strategy.md`, loads in every session. It tells Claude which
model to delegate to, to say once per task when your main model doesn't fit, to keep output and
reads small, and never to economise on security or verification. Claude only suggests a switch.
You decide, and nothing is enforced.

## 4. How a day looks

**Planning or design session** (intake, roadmap, specs, first screens, critique):

```text
/clear
/model opus
... work ... → decisions get written to context/
```

**Build session** (most of your time):

```text
/clear
/model sonnet
Read context/specs/NNN-x.md and build it.     (or: /pantoo:build-feature 03)
```

For a long build with real decision points (a big refactor, a bug that keeps coming back), add
`/advisor opus` at the start and `/advisor off` at the end.

**Single session, Opus orchestrating:** stay on Opus and tell it *"delegate the build steps to
implementer, then review."* Opus plans and reviews, and Sonnet writes the code in separate
contexts.

**Mid-session knobs that keep the cache:** `/effort high` (or `low`), and `ultrathink` in a prompt
for one deep turn.

**Between tasks:** commit, then `/clear`. Use `/compact keep the spec path, decisions and failing
tests` only when the next task continues this one. If Claude went down a wrong path, use
`/rewind` (Esc Esc) rather than arguing it back.

## 5. Habits that save the most

1. **One task per session.** `/clear` after each commit. Stale context is paid for on every turn.
2. **Pick the model at the start, not the middle.** A switch costs one full uncached reread.
3. **Be specific.** "Add validation to `signup` in `src/app/actions/auth.ts`" reads 2 files. "Improve
   auth" scans 40.
4. **Write the plan to a file.** Specs and the roadmap in `context/` are the cheap handoff between
   Opus and Sonnet and between sessions, and `/pantoo:save-session` records where you stopped.
5. **Verify with scripts, not screenshots.** See
   [browser-checks.md](../plugin/skills/verify-feature/references/browser-checks.md).
6. **Mind the cache lifetime on breaks.** Within plan usage, the main conversation's cache lasts
   1 hour, and subagents' caches last 5 minutes. Once you're past the plan limit and on usage
   credits, the main conversation's cache also drops to 5 minutes. After it expires, your first
   message rereads everything uncached. Finish the task, or `/clear`, before a long break.
7. **Disable MCP servers you aren't using** (`/mcp`). Prefer `gh` and other CLIs.

## 6. Check where usage goes

| Command | Shows |
| --- | --- |
| `/usage` | Plan bars, the share by skill, subagent and MCP server, recommendations (press `f` to apply some), and the cache hit rate |
| `/context` | What's filling the context window right now |
| `/skill-doctor` | The context cost of each skill |
| `/insights` | A report on how you work and where the friction is |

Check `/usage` weekly for a while. If one skill, MCP server or habit shows 10% or more, it will
say so.

## 7. Another machine

Run `npx pantoo-ai init` on each machine. `npx pantoo-ai doctor` lists what's missing.

## Sources

- [Model configuration](https://code.claude.com/docs/en/model-config): aliases, `opusplan`, effort levels and defaults
- [Manage costs](https://code.claude.com/docs/en/costs): reducing tokens, `/usage`, background usage
- [Prompt caching in Claude Code](https://code.claude.com/docs/en/prompt-caching): what invalidates the cache, TTLs
- [Subagents](https://code.claude.com/docs/en/sub-agents): frontmatter, model resolution order, the Explore override
- [Skills](https://code.claude.com/docs/en/skills): `model`/`effort` frontmatter, description budget
- [Advisor tool](https://code.claude.com/docs/en/advisor): pairings, cost, comparison with `opusplan`
- Prices: Claude API model table (cached 2026-10-06), checked through the `claude-api` skill
