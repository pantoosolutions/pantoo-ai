# pantoo-ai

A kit for [Claude Code](https://code.claude.com) that takes a project from idea to shipped code, with
the project's knowledge kept in files instead of chat. One command sets up any machine; one more sets
up any project.

- **A plugin, `pantoo`:** 13 skills for the whole loop (intake, roadmap, specs, build, verify, review,
  tests, docs) plus four agents and two hooks.
- **Context templates:** an `AGENTS.md` index and a `context/` folder (overview, architecture, standards,
  security rules, roadmap, specs, reviews, the design and copy files for UI projects, and a record of
  each workflow and agent for automation projects) that every skill reads and updates.
- **Rules and settings:** model and token routing, library docs through ctx7, web access cheapest tool
  first, and no AI attribution in commits and PRs. Each one is optional.
- **A CLI, `npx pantoo-ai`:** installs, updates, checks and removes all of the above, on macOS, Linux
  and Windows.

## Requirements

- **The `claude` CLI in a terminal**, version 2.1.177 or later, signed in. The kit installs the plugin
  by running `claude plugin`, and the VS Code extension alone doesn't put `claude` in your terminal.
  [Install Claude Code](https://code.claude.com/docs/en/setup) and check with `claude --version`
- [Node.js](https://nodejs.org/en/download) 20 or later, and git
- Windows: [Git for Windows](https://git-scm.com/downloads/win) (Claude Code uses its Git Bash)
- `curl`, to install impeccable (built into macOS and Windows 10 and later)
- Optional: Node.js 22 and Chrome, Edge or Chromium for taste's page checker, and the
  [GitHub CLI](https://cli.github.com) (`gh`) for pull requests. `doctor` warns when one is missing

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
| Design pack: [impeccable](https://github.com/pbakaus/impeccable), [taste](https://github.com/Leonxlnx/taste-skill), [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), six of [Emil Kowalski's motion skills](https://github.com/emilkowalski/skills) (`animate`, `review-animations`, `improve-animations`, `animation-performance`, `animation-vocabulary`, `emil-design-eng`), installed at pinned versions | on (`--no-design` to skip) |

It installs the plugin from this repo's marketplace, copies the rules to `~/.claude/rules/`, merges
the settings into `~/.claude/settings.json` (a backup is kept, and no key of yours is lost), then runs
`doctor`. Open Claude Code afterwards: the skills appear as `/pantoo:<skill>`.

## Start a project

In the project folder, new or existing:

```bash
npx pantoo-ai new
```

`new` asks the project type (`web-app`, `marketing`, `brand`, `pitch`, `mobile`, `backend`,
`automation`), whether code
already exists, and whether several apps share a contract. It then copies only the context files that
apply. It never overwrites anything. Then, in Claude Code:

```
/pantoo:start-project
```

For a new project this runs an interview; for existing code, a survey of the code. Either way it fills
`context/`, `AGENTS.md` and `CLAUDE.md`. Once the stack is known, it recommends skills and plugins for
its libraries from a [short catalog](plugin/skills/start-project/references/catalog.md), taken only from
each library's maker or from Emil Kowalski. It shows each command and its pin, installs only after your
yes and only at project scope, and installs nothing in a local project.

It also migrates other agents' instruction files (Cursor, Copilot, Windsurf, Cline, a hand-written
`CLAUDE.md`) after showing you the mapping. In a repo you can't commit to, use `npx pantoo-ai new --local`: the same files, kept out of git.

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
| `AGENTS.md`, `CLAUDE.md`, `context/`, `.pantoo.json`, `.gitattributes` | The plugin (`npx pantoo-ai init`) |
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
- **Check for newer design tools:** `npx pantoo-ai update --check` compares each pin with upstream and
  changes nothing.
- **Keep a tool at its installed version** on one machine: `npx pantoo-ai@latest update --hold taste`, and
  `npx pantoo-ai@latest update --release taste` to move it to the kit's pin again. `@latest` matters: an
  older copy of the CLI doesn't know `--hold`. Tools: `impeccable`, `taste`, `ui-ux-pro-max`,
  `emil`.
- **A setting you changed on purpose:** `npx pantoo-ai doctor --accept <key>` (`env`, `modelSettings`
  or `attribution`) shows it as ok until the kit's value for that key changes.

## Moving a project to another machine

A clone doesn't carry ignored context files such as `context/session.md`, the project's Claude memory
or your permission rules. Commit and push first, then on the old machine, in the project:

```bash
npx pantoo-ai move export
```

It writes a folder under `~/pantoo-move/` (`--to <folder>` picks another place). Get that folder to
the new machine, clone the repo there, switch to the same branch, and in the clone run:

```bash
npx pantoo-ai move import <folder>
```

`import` first checks that the clone has the same remote and branch and includes the exported commit.
It asks before adding a permission rule or replacing a file that differs from yours, and it adds no
rule to a `.claude/settings.local.json` that git tracks.

`export` leaves out the files `.pantoo.json` lists under `secrets`, and any `.env*`, `*.pem`, `*.key`
or `credentials.json`, and prints what it left. It doesn't read what's inside the other files, so a
key typed into a note travels with it.

## Commands

| Command | Does |
| --- | --- |
| `init` | Install the kit: plugin, rules, settings, commit guard, design pack |
| `new` | Scaffold `context/` in this folder and install its design companions |
| `add <name>` | Add one piece later: a design companion, the design pack, a rule, or `add source <tool>` for a design source (Figma, Penpot and others) |
| `update` | Replay the saved choices with the latest kit and move the design tools' pins |
| `doctor` | Check what's installed against what's expected, and the project in this folder |
| `remove` | Undo `init` for a scope, from the saved record |
| `move export` / `move import <folder>` | [Move a project](#moving-a-project-to-another-machine) to another machine. `doctor` lists the secrets to set up there |

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
ui-ux-pro-max (MIT), Emil Kowalski's skills (MIT).
