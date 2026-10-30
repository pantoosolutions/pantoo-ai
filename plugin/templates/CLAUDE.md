@AGENTS.md

## Compact instructions

When compacting, keep: the current task and its spec or plan path, decisions made and why, files
changed, failing checks with their exact errors, and open questions. Drop exploration output and
superseded attempts.

## Models for this project

Routing follows the global model-and-token-strategy rule. Specific to this project:

- High-risk areas (design on Opus · high, build on Sonnet · high, `deep-reviewer` before
  release): {{AUTH_PAYMENTS_DATA_PATHS}}.
- Hand work between sessions through files: "read context/specs/NNN-name.md and build it".

<!-- UI projects only: keep the section below, otherwise delete it. -->

## Design

Read `DESIGN.md`, `PRODUCT.md`, `context/ui/tokens.md`, `context/ui/rules.md` and
`context/ui/registry.md` before any UI work. `DESIGN.md` owns every token value; if two files
disagree, it wins. Never invent a colour, font, size, spacing or radius that isn't in it.
Check the registry before building a component, and record new ones with `capture-ui`.
Which design tool runs at which step, and this project's taste dials: `design-flow`.
After editing `DESIGN.md`: `npx -y -p @google/design.md designmd lint DESIGN.md`.
