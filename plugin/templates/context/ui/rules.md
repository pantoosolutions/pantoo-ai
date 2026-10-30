# UI Rules

> 🧭 GUIDANCE: Filled during intake Phase 2. Concise rules that keep the UI consistent across
> build sessions. Base them on the design; where the design is silent, propose a sane default
> and confirm. Replace every `{{...}}`, delete every `> 🧭 GUIDANCE:` line.

Design assets in `context/designs/` are the source of truth for visual decisions. These rules cover the
patterns and constraints that matter most, without over-specifying every pixel.

---

## Font

> 🧭 GUIDANCE: How the font is loaded and applied in the chosen stack, and any rule about
> fallbacks.

{{FONT_LOADING_RULE}}

---

## Layout

> 🧭 GUIDANCE: Page width, content padding, section gaps, header/nav dimensions, overall shape.

- {{LAYOUT_RULE}}
- {{LAYOUT_RULE}}

---

## Surfaces / Cards

> 🧭 GUIDANCE: The container model — how content sections are visually grouped, and the rules
> for them (background, border, radius, padding, shadow, what's forbidden).

{{SURFACE_MODEL}}

---

## Typography Hierarchy

> 🧭 GUIDANCE: The 2–4 text levels used consistently, with their exact recipes. Should match
> the roles in tokens.md.

{{TYPOGRAPHY_HIERARCHY}}

---

## Buttons

> 🧭 GUIDANCE: Variants (primary / secondary / ghost / …) with their recipes.

{{BUTTON_RULES}}

---

## Form Inputs

{{INPUT_RULES}}

---

## Badges / Tags

{{BADGE_RULES}}

---

## Other Recurring Components

> 🧭 GUIDANCE: Tables, lists, progress indicators, charts — whatever recurs in this design.
> Add a short block per pattern. Delete if none.

{{OTHER_COMPONENT_RULES}}

---

## Empty States

> 🧭 GUIDANCE: Every section that can be empty needs a defined empty state. State the rule.

{{EMPTY_STATE_RULE}}

---

## Do Nots

> 🧭 GUIDANCE: The most valuable list here — each item stops pattern drift. Be specific to this
> project's tokens and stack.

- {{DO_NOT}}
- {{DO_NOT}}
