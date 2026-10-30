# Design sources

A design reaches a project one of five ways. `context/designs/README.md` → Sources records each
source with its way; this file says how to read each way, how to record it, and how `sync` works.

Tool facts (official MCP server, sign-in, read and write tools, export quirks, plan needed) are in
`${CLAUDE_PLUGIN_ROOT}/design-sources.json`. Read the tool's entry before touching it. Its `checked`
date is more than six months old → say the facts may be stale, and check the tool's `docs` URL through
`docs-researcher` before relying on a server URL or tool name.

## 1. Where does the design live?

Ask once, unless the Sources table already answers. When a tool offers several ways, recommend the
first that gives exact values:

| Way | Arrives as | Values |
| --- | --- | --- |
| `tokens` | `DESIGN.md`, W3C DTCG `.tokens.json`, Tokens Studio JSON, Style Dictionary source | Exact |
| `code` | An exported or generated repo or folder (v0, Lovable, Framer or Webflow export, a Claude Design handoff, Storybook), or CSS | Exact |
| `mcp` | The tool's official MCP server | Exact for variables and styles; estimated from screenshots |
| `link` | A published page: a claude.ai artifact, a live site, a shared prototype | Exact for computed CSS |
| `files` | PDF, PNG, SVG, a brand guide, a zip export | Exact for SVG and code; estimated from images |

A tool's entry lists the ways it offers, its best first. Not in the file → pick the way by what
arrives. Several sources (a brand kit for colour and type, Figma for screens) → one row each; ask which
one owns each token group when both define it, and write that in `DESIGN.md`'s prose.

## 2. Record it

One row per source in `context/designs/README.md` → Sources (add the section from
`${CLAUDE_PLUGIN_ROOT}/templates/context/designs/README.md` if it's missing):

| Column | Holds |
| --- | --- |
| Tool | The id from `design-sources.json` (`figma`), else a short name (`brand kit`) |
| Way | `tokens`, `code`, `mcp`, `link` or `files` |
| Location | Path relative to the repo, URL, or file URL with the node ids that matter. Never a key, token or signed URL |
| Version | The source's own: a brand kit's version, the file's version or last-modified date, a commit, an export date |
| Last synced | Date of the last read that reached `DESIGN.md`; `never` until then |
| Owner | Who changes the source; the person to ask when it and `DESIGN.md` disagree |

Files and exports are copied into `context/designs/` (a zip extracted to `<tool>-<date>/`); the row
points at the copy and names the original in Location.

## 3. Read it, by way

**tokens.**
- `DESIGN.md`: lint it, then take it whole when it's this project's, or adapt it (look.md route A)
  when it's someone else's.
- DTCG (`$value`, `$type`): colour → colours, dimension → spacing or radius by group name,
  typography and font tokens → type. Resolve aliases (`{color.brand.500}`) to their values; keep the
  alias as a reference where `DESIGN.md` supports one.
- Tokens Studio (`value`, `type`, no `$`; `$themes` and `$metadata` at the top): take only the sets the
  active theme enables, in `tokenSetOrder`; turn string dimensions (`"16"`, `"16px"`) into px;
  compute math (`{spacing.base} * 2`).
- Style Dictionary: read the source tokens, not the built output, when both are there.

**code.** Theme config, CSS custom properties, Tailwind `@theme` or `theme.extend`, then component
styles. Values written in the code beat the class names around them. A Claude Design handoff has no
documented shape: list what arrived first, then read its CSS and markup like any export.

**mcp.**
1. No server for the tool in `.mcp.json` → `npx pantoo-ai add source <tool>`, restart Claude Code,
   then the sign-in from its `signIn` field. Each person uses their own account. Never write a key
   into a file; a key the server needs comes from an environment variable.
2. Read only: the tool's `read` tools, variables and styles first (exact), then components. A
   screenshot only confirms intent; every value read off one is marked estimated.
3. Never call a tool listed under `writes` unless the developer asks for that change in this session.
4. Rate limits: read each node once per sync. Record the node ids in Location so a sync reads the
   same frames.

**link.** A claude.ai artifact → the Artifact tool's `read`: the owner gets raw HTML, anyone else a
summary, which isn't a source (ask for edit access or an export). A live site or prototype → a
Playwright script that prints `getComputedStyle` for `:root` custom properties and the key elements
(body, headings, buttons, inputs, cards); never values guessed from a screenshot.

**files.** SVG and exported code are exact. A brand guide's printed hex and font names count as
exact. Everything taken from an image is estimated.

## 4. Write DESIGN.md

Exact values verbatim. Every estimated value gets a note in `DESIGN.md`'s prose:
`Estimated from <file or frame>.` Then continue at look.md section 2 (lint). Set the row's Version and
Last synced.

## sync

1. Read the Sources table. No rows → `DESIGN.md` is the source; say so and stop.
2. Per row, check the version first (cheap: the kit's version line, file metadata, the tool's last
   modified). Unchanged since Last synced → mark it unchanged and skip.
3. Re-read each changed source by its way (section 3) and diff its values against `DESIGN.md`, token
   by token: changed or new in the source. A token `DESIGN.md` has and the source doesn't define is
   the project's own (or another source's), not a difference; one the source dropped since its last
   version shows in the source's change notes, and is asked about like any other difference.
4. Show the differences per source as a table (token, ours, theirs). Ask per difference, or per group
   when one cause explains them:
   - **take theirs**: write it into `DESIGN.md`;
   - **keep ours**: add one line to `DESIGN.md`'s prose,
     `Kept over <tool> <version>: <token> <ours> (source <theirs>). <reason>.`
     A difference with such a line isn't asked again until the source's value moves;
   - **skip**: asked again next sync.
5. Lint. Re-export if `CLAUDE.md` → Design has an export command. Update `context/ui/tokens.md` if a
   role was added or removed. Then set Version and Last synced on every row read.
6. Code that now drifts from `DESIGN.md` → `/pantoo:capture-ui audit`.

Never silent, never wholesale: a source never overwrites `DESIGN.md` in one go, and nothing is
written back to a source.
