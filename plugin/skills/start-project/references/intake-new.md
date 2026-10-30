# Intake: new project

No code yet. You interview the developer and write the answers into `context/`. Be a technical
product partner, not a form: surface contradictions, push on vague answers, name the decisions
they haven't noticed they need to make. A good intake leaves the idea clearer than it arrived.

- **Recommend, don't just collect.** When they're unsure, offer a default with a one-line reason.
- **Cut scope.** Ask "v1 or later?" of every feature. A tight v1 beats a long one.
- **No stack assumptions.** Ask; offer options with trade-offs; never default silently.

```
Phase 0  Orientation           the idea in one sentence, confirmed
Phase 1  Product               context/overview.md
Phase 2  Design (UI only)      context/ui/tokens.md, context/ui/rules.md
Phase 3  Architecture          context/architecture.md
Phase 4  Standards             context/standards.md, context/security.md, context/libraries.md
Phase 5  Review                read everything back
```

The roadmap is not part of the intake: `plan-roadmap` writes it next.

## Phase 0: Orientation

Ask: what is it and who is it for; the one thing a user must be able to do; the pain it removes;
what it resembles and how it differs; what "v1 works" looks like. Reflect it back in one sentence
of your own and get a "yes, that's it". That sentence anchors every later phase.

## Phase 1: Product → `overview.md`

Spend the effort on **Core User Flow** (concrete enough to build a clickable prototype from) and
the **scope lists**. If they list fifteen features, help find the four that make v1 and move the
rest to out of scope. Rename "Pages" to "Commands", "Endpoints" or "Screens" when it isn't a
multi-page app. The core data here is the concept and who may change it; the schema waits for
Phase 3.

## Phase 2: Design → `ui/tokens.md`, `ui/rules.md` (UI projects only)

1. **`DESIGN.md` at the root wins.** It must lint clean
   (`npx -y -p @google/design.md designmd lint DESIGN.md`). `tokens.md` maps its tokens to roles and
   to how code references them; it never adds a value. A missing token is proposed **in
   DESIGN.md**, re-linted, then mapped. Read `PRODUCT.md` for tone; it feeds the Do Nots.
2. Without `DESIGN.md`: rows in `context/designs/README.md` → Sources mean the design lives
   elsewhere; run `/pantoo:design-flow look` first, which reads them into `DESIGN.md`. Else read `context/designs/`. **Code beats images** for exact values (hex,
   px, font names); images confirm intent, rhythm and states. Group colours into roles (surface,
   text-muted, accent), never raw names; note the single accent. No assets at all → propose a
   small neutral set marked `{{TBD: provisional, no design yet}}` and recommend creating
   `DESIGN.md` before the build.
3. The token mechanism (CSS variables, theme object, …) is decided after Phase 3 picks the stack.
4. `rules.md`: layout, surfaces, type hierarchy, buttons, inputs, empty states, and **Do Nots**
   (one accent, all borders from the border token, no hard-coded hex). Where the design is
   silent, propose a default and confirm.

## Phase 3: Architecture → `architecture.md`

Layer by layer, with options and trade-offs: platform and shape, language and framework,
backend / data / auth / storage, third-party services, styling (must fit Phase 2's mechanism).
Then folder structure (concrete, only real folders), system boundaries (what each folder owns
and may not do), data flow for the main operations, data model tied to Phase 1's core data, auth
model, and **invariants**: flat, checkable rules ("every query is scoped to the current user").
Ask what would scare them if it silently broke; each answer is an invariant.

## Phase 4: Standards → `standards.md`, `security.md`, `libraries.md`

- `standards.md`: anchored to the stack, from real choices: loose types, export style, how errors
  reach users, the bar for a new dependency, the test framework (Testing section).
- `security.md`: keep the rules as written; fill **Project mapping** with the mechanism per
  rule, `n/a — reason`, or `todo`. Five questions settle most rows: auth provider; which
  database and does the client reach it directly; any uploads; any endpoint that costs money
  per call (AI, email, SMS); where it deploys and from which CI.
- `libraries.md`: one section per library from Phase 3, on how **this** project uses it, plus
  whether a skill or MCP server covers it. Keep the order-of-authority preamble.

## Phase 5: Review

Read every file back and fix before summarising:

- Routes in `overview.md` match `architecture.md`; every library in the stack has a
  `libraries.md` section and is in the approved dependencies; stack consistent across the three.
- Tokens in `ui/tokens.md` match `DESIGN.md` and `ui/rules.md`.
- Every security mapping row has a mechanism, `n/a — reason` or `todo`; list the `todo`s for
  `plan-roadmap`.
- What's still fuzzy is `{{TBD: …}}`, not faked.

Tell the developer what's solid, what's TBD, and the three decisions to revisit before building.
