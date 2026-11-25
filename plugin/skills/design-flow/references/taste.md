# Building website pages with taste

taste covers **website pages only**: marketing, brand and landing pages, and a web app's public
pages. An **app screen** (a dashboard, settings, an inbox, anything people work in) is built from
`DESIGN.md` and `context/ui/` and judged by impeccable: don't use taste for it, even if the
installed copy's description offers to.

## `DESIGN.md` wins

taste picks a palette and a font pairing of its own. Here it decides layout, sections and motion;
`DESIGN.md` decides every value. Tell it so before it plans the page:

- Colours: `DESIGN.md`'s go in through `start.mjs brand`, in place of a dealt palette.
- Type and radius: `brand` takes only taste's own pairings, so replace the printed `--font-*` and
  radius values in `:root` with `DESIGN.md`'s.
- A finding that only asks to depart from `DESIGN.md` → waive it in `.taste-skill/waivers.json`,
  with `DESIGN.md` as the reason. It takes five waivers at most. More than that, or a value taste
  refuses outright (violet) → ask the developer whether the page or `DESIGN.md` changes.

## Its Stop hook

While taste is in use, a hook runs when Claude finishes a turn:

- With a page build open, it checks the page in a headless browser (it can take minutes) and can
  send Claude back to fix what it finds. To ask the developer something, stop again. When they say
  to stop or ship as is: `gate.mjs --done "<what they said>"`, then report the open failures.
- A page taste made that was never armed gets one blocked stop, saying how to arm it. A page you
  aren't building → stop again.

It needs Node 22+ and Chrome, Edge or Chromium (`CHROME_PATH` for another location);
`npx pantoo-ai doctor` checks both.

## Its files

It keeps build state in `.taste-skill/`, which is never committed. `new` ignores it; in a project
set up earlier, add `.taste-skill/` to `.gitignore` (to `.git/info/exclude` in a local-only
project) before the first build. It also copies its own CSS and JS kit into the site: commit what
the page loads.

A line of taste settings that an older kit version left in `CLAUDE.md` → Design is ignored.
