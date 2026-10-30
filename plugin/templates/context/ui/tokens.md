# UI Tokens

> 🧭 GUIDANCE: Filled during intake Phase 2 from the assets in `context/designs/`. Replace every
> `{{...}}`, delete every `> 🧭 GUIDANCE:` line. Pull EXACT values from design code; estimate
> and label estimates when working from images only. Code wins over images on conflicts. Group
> raw values into semantic roles — the codebase references roles, never raw hexes.

These are the design tokens for the project. Use these values throughout the codebase — never
hardcode colors, sizes, or radii in components.

---

## Source of Truth

> 🧭 GUIDANCE: If the project has a root `DESIGN.md`, keep the first line below and delete the
> second. Every value in the tables below must then match DESIGN.md exactly. Add a column, or
> use the role name, so each row traces back to its DESIGN.md token. With no DESIGN.md, keep
> the second line.

Token **values** are defined in [`DESIGN.md`](../../DESIGN.md) at the project root. This file maps
them into the codebase. On any conflict DESIGN.md wins. Change values there, re-lint, then
update this file.

Token values are defined here (no DESIGN.md for this project).

---

## Token Mechanism

> 🧭 GUIDANCE: State HOW tokens are defined and consumed in the chosen stack (CSS variables,
> a theme object, a design-token JSON, Tailwind `@theme`, etc.). This is decided against the
> stack from architecture.md, not copied from the design's own mechanism. Show the one correct
> way to reference a token and the wrong ways to avoid.

{{HOW_TOKENS_ARE_DEFINED_AND_CONSUMED}}

```{{lang}}
// Correct — references a token
{{CORRECT_EXAMPLE}}

// Never — hardcoded raw value
{{WRONG_EXAMPLE}}
```

---

## Color Tokens

> 🧭 GUIDANCE: List every color as a named role with its value. Organize by purpose. Mark the
> single primary accent clearly. Note any value that is estimated from an image.

### Backgrounds & surfaces

| Role | Value |
| ---- | ----- |
| {{background}} | {{#value}} |
| {{surface}} | {{#value}} |

### Borders

| Role | Value |
| ---- | ----- |
| {{border}} | {{#value}} |

### Text

| Role | Value |
| ---- | ----- |
| {{text-primary}} | {{#value}} |
| {{text-secondary}} | {{#value}} |
| {{text-muted}} | {{#value}} |

### Accent

> 🧭 GUIDANCE: The single primary brand color and its variants. There should be exactly one
> accent family.

| Role | Value |
| ---- | ----- |
| {{accent}} | {{#value}} |

### Semantic (success / info / warning / error)

| Role | Value |
| ---- | ----- |
| {{success}} | {{#value}} |
| {{info}} | {{#value}} |
| {{warning}} | {{#value}} |
| {{error}} | {{#value}} |

---

## Typography

> 🧭 GUIDANCE: Font family/families, then one row per text role with size / weight /
> line-height / color role. Name roles, not one-offs.

Font family: {{FONT_FAMILY}}

| Role | Size | Weight | Line height | Color role |
| ---- | ---- | ------ | ----------- | ---------- |
| {{heading}} | {{px}} | {{w}} | {{px}} | {{role}} |
| {{body}} | {{px}} | {{w}} | {{px}} | {{role}} |
| {{label}} | {{px}} | {{w}} | {{px}} | {{role}} |
| {{muted}} | {{px}} | {{w}} | {{px}} | {{role}} |

---

## Spacing

> 🧭 GUIDANCE: The recurring spacing scale. Derive a consistent scale even if the design is
> messy — pick the dominant values and note their typical usage.

| Token | Value | Usage |
| ----- | ----- | ----- |
| {{token}} | {{px}} | {{usage}} |

---

## Radii, Shadows, Borders

| Token | Value |
| ----- | ----- |
| {{radius-sm}} | {{px}} |
| {{radius-md}} | {{px}} |
| {{shadow-card}} | {{value}} |
| {{border-width}} | {{value}} |

---

## Component Tokens

> 🧭 GUIDANCE: Concrete recipes for the recurring components, expressed in the token roles
> above. Add one block per component the design actually contains (buttons, inputs, cards,
> badges, etc.).

### {{COMPONENT}}

```
{{property}}: {{token-or-value}}
{{property}}: {{token-or-value}}
```

---

## Invariants

> 🧭 GUIDANCE: The non-negotiable token rules. Capture things like "only one accent", "never
> hardcode hex in components", "all borders use the border token".

- {{TOKEN_INVARIANT}}
- {{TOKEN_INVARIANT}}
