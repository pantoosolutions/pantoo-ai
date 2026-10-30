# Design runbook

How the kit's design tools fit together in a UI project. `/pantoo:design-flow` runs this for you;
this page is for reading once.

## What gets installed

| Tool | Job | Installed by |
| --- | --- | --- |
| impeccable | Judges UI: product brief (`init`), `shape`, `critique`, `audit`, `polish` and targeted fixes | `npx pantoo-ai init` (design pack) |
| taste (`design-taste-frontend`) | Shapes what Claude generates: layout, type, motion, three dials | `npx pantoo-ai init` (design pack) |
| ui-ux-pro-max | Reference: styles, palettes, font pairings, UX guidelines; generates a starting design system | `npx pantoo-ai init` (design pack) |
| ui-ux-pro-max companions | Narrow helpers that fit one kind of project | `npx pantoo-ai new`, from the project type |
| Google DESIGN.md CLI | Lints `DESIGN.md` (structure, WCAG contrast) and exports tokens | nothing: runs through `npx` |

Versions are pinned in `third-party.json`; `npx pantoo-ai update` moves them. Don't run the tools' own
updaters, or the pins drift.

### Companions per project type

| Project type | Companions |
| --- | --- |
| Web app, dashboard, SaaS | `design-system`; `ui-styling` with shadcn/Tailwind |
| Marketing site, landing | `brand`, `banner-design` |
| Brand or identity work | `brand`, `design` (needs a Gemini API key) |
| Pitch or presentation | `slides` |
| API, CLI, backend only | none |

They live in the project's `.claude/skills/` and are committed, so teammates get the same set. They
trigger on words like "design", "brand" or "slides", which is why they aren't global. Add one later
with `npx pantoo-ai add <companion>`.

## The order

| Step | What | Produces |
| --- | --- | --- |
| 1 | Product intake (`/pantoo:start-project`, product phase) | `context/overview.md` |
| 2 | Product brief (`/impeccable init`) | `PRODUCT.md` |
| 3 | Choose the look, lint it, preview it (`/pantoo:design-flow look`) | `DESIGN.md`, taste dials |
| 4 | Finish the intake: tokens mapped, stack chosen, export set | `context/ui/`, the rest of `context/` |
| 5 | Per screen: spec or shape → build → capture → critique, audit, polish | screens, registry entries |

The product comes before the look because impeccable judges against `PRODUCT.md`. The look comes
before the token wiring so the intake maps real values instead of guessing them.

## Where the design comes from

`DESIGN.md` is the one place a project's design values live. Anything upstream of it (a Figma file, a
token export, a brand kit, a Claude Design handoff, a live site) is a **source**, recorded in
`context/designs/README.md` → Sources with its way, location, version and last sync.

| Way | Example | Values |
| --- | --- | --- |
| Token file | `DESIGN.md` from a brand kit or Stitch, DTCG `.tokens.json`, Tokens Studio JSON | Exact |
| Code | v0, Lovable or Framer export, Claude Design handoff, a brand kit's CSS | Exact |
| Live tool (MCP) | Figma, Penpot, Sketch, Webflow over their official MCP servers | Exact for variables |
| Link | A claude.ai artifact, a live site | Exact for computed CSS |
| Files | PDF brand guide, PNG, SVG, zip export | Estimated from images |

- `npx pantoo-ai add source <tool>` (or `new --source <tool>`) writes the tool's official MCP server
  into `.mcp.json` and adds a row. Each person signs in with their own account; keys come from
  environment variables, never the file. Known tools and their quirks: `plugin/design-sources.json`.
- `/pantoo:design-flow look` reads the sources into `DESIGN.md`; `/pantoo:design-flow sync` re-reads
  them later and asks about every difference: take theirs, keep ours (with the reason in `DESIGN.md`),
  or skip.
- MCP servers are read-only by habit: Claude never edits a design canvas unless you ask.
- `doctor` checks that every MCP source has a server in `.mcp.json` and that no key is written there.

## Rules of thumb

- **One generator, one reviewer.** taste builds, impeccable reviews. Asking both to build one screen
  pulls in two directions.
- **`DESIGN.md` owns values.** `context/ui/tokens.md` maps them into code; the registry records what
  was built. A value that isn't in `DESIGN.md` gets added there first, then linted.
- **Previews come from code.** The throwaway `design-preview.html` while choosing the look, then real
  screens with mock data. Syncing a repo into a design canvas costs a lot of usage and only mirrors
  decisions already made; keep it for reviewers who won't run the app.
- **One screen per session.** Critique across several screens gets vague.
- **When the look changes:** `DESIGN.md` first, lint, re-export, then `tokens.md`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| A skill doesn't show up | Restart Claude Code; skills load at session start. Then `npx pantoo-ai doctor` |
| Two copies of a skill | Installed globally by hand and by the kit. Keep the kit's; remove the other |
| A companion fires when you wanted impeccable or taste | Name the skill you want in the prompt |
| `designmd lint` prints nothing | You used `npx @google/design.md`; use `npx -y -p @google/design.md designmd lint DESIGN.md` |
| ui-ux-pro-max scripts fail on Windows | It calls `python3`; see the machine rule `doctor` writes |
| An MCP design source doesn't respond | Restart Claude Code, then `/mcp` to sign in (Sketch: start its server in Sketch first). `npx pantoo-ai doctor` says whether `.mcp.json` has it |
| Claude ignores `DESIGN.md` | It must be at the project root, named exactly `DESIGN.md`, and `CLAUDE.md` → Design must point to it |
