# Choose the look

The product comes first (`PRODUCT.md` exists), so the look can fit the audience. The look comes before
the stack's token wiring, so `start-project` maps real tokens instead of guessing.

## 1. Route

Ask "where does the design live?", recommending by what exists: rows in `context/designs/README.md` →
Sources, or assets in `context/designs/` → C; a reference brand the developer names → A; neither → B.

**A. Adapt an existing DESIGN.md.** The developer gives a file or a brand from a DESIGN.md library
(for example VoltAgent's awesome-design-md). Copy it to `DESIGN.md`, then rewrite it for this product
using `PRODUCT.md`: keep the layout and type principles, change the name, the accent and anything
brand-specific. It must not read as the source brand.

**B. Generate one.** Use ui-ux-pro-max to generate a design system for the product (one line: what it
does, who it's for), then convert it into a `DESIGN.md` in Google's DESIGN.md format at the root.
Delete the generator's intermediate folder once `DESIGN.md` holds everything.

**C. From the project's designs.** Read [sources.md](sources.md) and follow sections 1–4: settle the
way (token file, code, live tool over MCP, link or files), record the source, read it, write a
`DESIGN.md` in Google's format with its exact tokens and principles. Mark every value estimated from an
image or screenshot.

## 2. Lint

```bash
npx -y -p @google/design.md designmd lint DESIGN.md
```

It checks structure and WCAG contrast. Fix every error before going on. Always the `-p … designmd`
form: plain `npx @google/design.md` prints nothing on Windows and looks like a pass.

## 3. Preview

Mock the main screen as one self-contained `design-preview.html` at the root: static HTML, inline CSS,
realistic mock data, no framework, built only from `DESIGN.md` and `PRODUCT.md`. Ask the developer to
open it at desktop and phone width. Wrong look → change `DESIGN.md` (or try another route into
`design-preview-b.html` and compare), lint, preview again. Iterate here; it's cheap now and expensive
after the build starts. Delete the preview files when the look is agreed; they're never a source.

## 4. Dials

Record taste's three dials for this project in `CLAUDE.md` → Design, inferred from `PRODUCT.md` and
confirmed with the developer (taste's own presets are the starting point):

```markdown
Taste dials: DESIGN_VARIANCE <1–10> · MOTION_INTENSITY <1–10> · VISUAL_DENSITY <1–10>
```

Dashboards and data-heavy tools sit low on variance and high on density; marketing sites the
opposite; trust-first and regulated products low on both variance and motion.

## 5. Export (once the stack is known)

Tailwind v4: `npx -y -p @google/design.md designmd export --format css-tailwind DESIGN.md > <styles>/theme.css`,
imported from the main CSS file. Tailwind v3: `--format json-tailwind` into `theme.extend`. Otherwise
`css-vars` or `dtcg`. Put the exact command in `CLAUDE.md` → Design, so `change-look` reruns it.
