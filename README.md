# pantoo-ai

A kit for [Claude Code](https://code.claude.com) that takes a project from idea to shipped code, with
the project's knowledge kept in files instead of chat. One command sets up any machine; one more sets
up any project.

- **A plugin, `pantoo`:** 13 skills for the whole loop (intake, roadmap, specs, build, verify, review,
  tests, docs) plus four agents and two hooks.
- **Context templates:** an `AGENTS.md` index and a `context/` folder (overview, architecture, standards,
  security rules, roadmap, specs, reviews) that every skill reads and updates.
- **Rules and settings:** model and token routing, library docs through ctx7, web access cheapest tool
  first, and no AI attribution in commits and PRs. Each one is optional.
- **A CLI, `npx pantoo-ai`:** installs, updates, checks and removes all of the above, on macOS, Linux
  and Windows.

## Requirements

- Claude Code 2.1.177 or later, signed in
- Node.js 20 or later, and git
- Windows: Git for Windows (Claude Code uses its Git Bash)

## Install

```bash
npx pantoo-ai@latest init
```

`init` asks a few questions, each with a recommended default (`--yes` accepts them all):

| Question | Default |
| --- | --- |
| Scope: `user` (every project on this machine) or `project` (this repo, shared with the team) | user |
| Rules: model routing, ctx7 for docs, web access, no AI attribution | all on |
| Commit guard: block, warn or off, for commits and PRs that credit an AI | block |
| Design pack: [impeccable](https://github.com/pbakaus/impeccable), [taste](https://github.com/Leonxlnx/taste-skill), [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), installed at pinned versions | on (`--no-design` to skip) |

It installs the plugin from this repo's marketplace, copies the rules to `~/.claude/rules/`, merges
the settings into `~/.claude/settings.json` (a backup is kept, and no key of yours is lost), then runs
`doctor`. Open Claude Code afterwards: the skills appear as `/pantoo:<skill>`.

## Start a project

In the project folder, new or existing:

```bash
npx pantoo-ai new
```

`new` asks the project type (`web-app`, `marketing`, `brand`, `pitch`, `backend`), whether code
already exists, and whether several apps share a contract. It then copies only the context files that
apply. It never overwrites anything. Then, in Claude Code:

```
/pantoo:start-project
```

For a new project this runs an interview; for existing code, a survey of the code. Either way it fills
`context/`, `AGENTS.md` and `CLAUDE.md`. It also migrates other agents' instruction files (Cursor,
Copilot, Windsurf, Cline, a hand-written `CLAUDE.md`) after showing you the mapping. In a repo you
can't commit to, use `npx pantoo-ai new --local`: the same files, kept out of git.

## The loop

| Step | Skill | What it does |
| --- | --- | --- |
| 1 | `/pantoo:plan-roadmap` | Orders the work into slices in `context/roadmap.md`. Run bare, it says where things stand and what's next |
| 2 | `/pantoo:write-spec` | Settles one load-bearing decision into a spec with acceptance criteria, ending at an approval gate |
| 3 | `/pantoo:build-feature` | Builds one slice from its spec. Stops if a decision is still unmade |
| 4 | `/pantoo:verify-feature` | Runs the real app against every acceptance criterion |
| 5 | `/pantoo:review-change` | A fresh-model review against the spec, standards, security rules and UI registry |
| 6 | `/pantoo:write-tests` | Tests traced to the spec, with the framework recorded in `context/standards.md` |
| 7 | `/pantoo:write-docs` | PR description, changelog, release notes or postmortem, from the real diff |
| 8 | `/pantoo:sync-context` | Brings the roadmap, `AGENTS.md` and known issues in line with what shipped |

Alongside the loop:

- `/pantoo:save-session`: `save` before `/clear` or stopping, `resume` to pick up where you left off.
- `/pantoo:diagnose-problem`: when a check fails or two fixes haven't worked.
- `/pantoo:capture-ui`: records a new component's visual patterns so later ones match.
- `/pantoo:design-flow`: routes design work to the right tool and keeps `DESIGN.md` the one source of
  design values.

Each project has a depth tier, and a slice can override it: Prototype (build), Alpha (+ verify), Beta
(+ tests), GA (+ review and docs). The skills suggest the next step; they never force it.

## Working in a team

A project commits its context and the plugin's marketplace entry:

| In the repo | Per person, per machine |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, `context/`, `.pantoo.json` | The plugin (`npx pantoo-ai init`) |
| `.claude/settings.json` (marketplace + enabled plugin) | Rules and settings in `~/.claude/` |
| `.claude/skills/<companion>/` (design companions) | `context/session.md` (gitignored) |

A teammate joining a project runs `npx pantoo-ai@latest init` once on their machine, clones the repo,
trusts the folder in Claude Code, and runs `npx pantoo-ai doctor` in it. `doctor` names anything
missing and the command that fixes it.

## Keeping it current

- **The plugin auto-updates** when Claude Code starts. Only released versions ship.
- **Rules, settings and pinned design tools:** `npx pantoo-ai update`. It always runs the latest CLI,
  replays your saved choices, replaces rules you haven't edited and keeps the ones you have, with a
  warning.
- **A project's context** is your content, so a newer template is never re-applied. When the layout
  changes, `doctor` flags the project and `/pantoo:start-project` migrates it.

## Commands

| Command | Does |
| --- | --- |
| `init` | Install the kit: plugin, rules, settings, commit guard, design pack |
| `new` | Scaffold `context/` in this folder and install its design companions |
| `add <name>` | Add one piece later: a design companion, the design pack, a rule, or `add source <tool>` for a design source (Figma, Penpot and others) |
| `update` | Replay the saved choices with the latest kit and move the design tools' pins |
| `doctor` | Check what's installed against what's expected, and the project in this folder |
| `remove` | Undo `init` for a scope, from the saved record |

`npx pantoo-ai --help` lists every flag. Each prompt has one, so the CLI also runs non-interactively.

## Developing the kit

```bash
git clone https://github.com/pantoosolutions/pantoo-ai && cd pantoo-ai && npm ci
npm test            # CLI tests
npm run check       # skill portability and size budgets
claude --plugin-dir ./plugin   # try your changes in one session, without touching your install
```

Skill authoring rules are in [`docs/authoring.md`](docs/authoring.md). Run `npm run check` before each
commit. Don't point your installed marketplace at a clone: every project would then run whatever
branch the clone has checked out, and `doctor` warns about it.

## License

[MIT](LICENSE), © Pantoo Solutions S.A.C. The skills adapt ideas from `jsmastery-pro/skills` and
`jsmastery-pro/jsm-agent-skill` (MIT); see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The
design tools are installed from their own repos, not copied: impeccable (Apache-2.0), taste (MIT),
ui-ux-pro-max (MIT).
