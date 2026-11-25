# Skill catalog

Read once the stack is known: intake-new Phase 3, or intake-existing Phase 2 from the lockfile.
It recommends skills and plugins **by library**, only from the library's maker or one vetted
maintainer (Emil Kowalski). It never recommends a community skill or a paid tool.

Checked 2026-11-25: last commit, licence and skill names of every source below. Names are as
`npx -y skills@1.9.0 add <repo> --list` prints them (the `name:` in frontmatter, not the folder).

## Motion and media first

Ask before Phase 3 picks libraries, each with a recommendation:

- Motion: none, micro-interactions (hover, enter, state changes), or scroll storytelling.
- 3D: none, or a scene or product viewer.
- Video: none, or video made in code.

Then Phase 3 picks **one motion library** (none, CSS only, Motion, GSAP, Lottie; on React Native,
Reanimated) and writes it to `architecture.md` → Invariants: "Motion uses <library> only". A
second one later is a decision, not a dependency. One design generator per project too: the kit's design pack is it.

## How to recommend

1. Match every library in the stack to a row below. A library with no row: `none: ctx7`.
2. Recommend one entry per need, never a whole repo. Name each skill with `--skill`. Several
   repos also hold skills for their own contributors (`docs-diagrams` in Next.js, `antfu-*`).
3. Show every command and its pin before asking, with the row's Watch note. Ask once for all of
   them. Install only after a yes, and only at project scope (never `-g`, never `--scope user`),
   so `skills-lock.json` or `.claude/settings.json` holds the pick and teammates get it.
4. After installing, read each new `SKILL.md` frontmatter and say if it has `allowed-tools`,
   `hooks`, or a `` !`command` `` line that runs when the skill loads. Anything the Watch column
   didn't name is new since this check: say so and offer to remove it.
5. Write each answer into `libraries.md` at once, even mid-intake: that library's section with
   only its **Check first:** line, which the standards phase fills out later. A `/clear` then
   loses nothing. The line:
   `Skill: <names> (<repo>@<short sha or tag>)`, `Plugin: <name> (<repo>@<short sha>)`, or
   `none: ctx7`. A no is recorded the same way: `none: ctx7 (declined <skill>)`.

Local projects (`.pantoo.json` → `local`): project scope would add files to the team's repo.
Recommend, record in `libraries.md`, and install nothing.

## Install commands

Skills, pinned to a commit (resolve `<sha>` from the default branch at install time):

```bash
git ls-remote https://github.com/<repo> HEAD | cut -f1
npx -y skills@1.9.0 add <repo>#<sha> --skill <name> [--skill <name>…] -a claude-code -y --copy
```

Plugins, pinned the same way (needs Claude Code 2.1.324 or later; check `claude --version`):

```bash
claude plugin marketplace add <repo>#<sha> --scope project
claude plugin install <plugin>@<marketplace> --scope project
```

Third-party marketplaces don't auto-update, and the pin keeps a refresh from moving them. A plugin
or skill changes only when someone re-runs its commands with a new sha and commits the result.

## Rows

| Stack has | Recommend | Source | Pin | Watch |
| --- | --- | --- | --- | --- |
| Next.js 16.3 or later | `next-dev-loop`; add `next-cache-components-adoption` when Cache Components is on or planned | `vercel/next.js` (MIT) | Tag `v<installed next version>`, never main or canary | Next.js before 16.3 has no skills: `none: ctx7` |
| React or Next.js | `vercel-react-best-practices`, `vercel-composition-patterns` | `vercel-labs/agent-skills` | sha | No repo licence: install only, never copy into the kit |
| React Native, bare (no Expo) | `vercel-react-native-skills` | `vercel-labs/agent-skills` | sha | As above |
| Expo | the `expo` plugin (marketplace `expo-plugins`); Emil's `animate-expo`, `gestures` | `expo/skills` (MIT); `emilkowalski/skills` | sha; Emil at the kit's sha | Skip `expo-experiments`: APIs not final |
| Native iOS (Swift) | Emil's `write-swift` | `emilkowalski/skills` | the kit's sha | |
| shadcn/ui | `shadcn` | `shadcn-ui/ui` (MIT) | sha | Runs `npx shadcn@latest info --json` on every load and pre-approves `npx shadcn@latest *`. It replaces the old `ui-styling` companion; remove that one if present |
| SvelteKit | the `svelte` plugin (marketplace `svelte`) | `sveltejs/ai-tools` (MIT) | sha | Starts an MCP server with unpinned `npx -y @sveltejs/mcp`, and an LSP that needs `svelteserver` on the PATH |
| Vue, Nuxt, Pinia, Vite, Vitest, UnoCSS, VitePress, Nitro | the skill named after each library in the stack (`vue`, `nuxt`, …) | `antfu/skills` (MIT, Vue and Vite core team) | sha | Skip `antfu`, `antfu-*` and `pnpm`: personal workflow |
| Nuxt UI | `nuxt-ui` | `nuxt/ui` (MIT) | Tag `v<installed @nuxt/ui version>` | A tag with no `skills/nuxt-ui`: `none: ctx7` |
| GSAP | `gsap-core`, `gsap-timeline`, `gsap-performance`; `gsap-scrolltrigger` for scroll; `gsap-react` on React, `gsap-frameworks` on Vue or Svelte; `gsap-plugins` when SplitText, Flip and so on are used | `greensock/gsap-skills` (MIT) | sha | **Stale**: no commit since 2026-04-21. Check its API against ctx7 before relying on it |
| Motion (Framer Motion) | `none: ctx7` | | | Emil's skills in the design pack cover the craft |
| Lottie | `motion-design` | `LottieFiles/motion-design-skill` (MIT) | sha | Only when Lottie is the motion library: it overlaps Emil's `animate` |
| Remotion | `remotion-best-practices` (router); add `remotion-captions`, `remotion-render` when used | `remotion-dev/skills` | sha | No repo licence: install only. Remotion needs a paid licence for some companies; say so |
| Astro | `none: ctx7` | | | GSAP on Astro: the notes below |
| 3D (three.js, React Three Fiber) | `none: ctx7` | | | No official skill |

Emil on request, at the kit's sha, when the developer asks for the job: `apple-design`,
`choreograph`, `remove-animations`, `find-animation-opportunities`, `mobile-native`, `break-ui`.
The kit's sha is `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c`; Emil's base six are already in the
design pack at user scope, so never install those again.

## GSAP on Astro

When the stack has both, write these into `libraries.md` → GSAP as rules:

- Load GSAP with dynamic `import()` inside the component script, not at the top of a layout.
- With view transitions, initialise on `astro:page-load`, and kill every ScrollTrigger on
  `astro:before-swap`.
- 3D lives in one island with `client:visible`.

## Never recommend

- A second design generator (`frontend-design` and similar): taste and `DESIGN.md` win.
- Skills that duplicate the kit: `web-design-guidelines` (`impeccable audit`), `webapp-testing`
  or a Playwright MCP (`verify-feature`, `verifier`), `astro-developer` (for Astro's own
  contributors), repackages of Emil's skills.
- Paid generators or any tool that spends credits per call (Higgsfield, Meshy).
