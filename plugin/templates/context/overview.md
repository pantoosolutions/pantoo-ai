# Project Overview

> 🧭 GUIDANCE: Filled during intake Phase 1. Replace every `{{...}}`. Delete each
> `> 🧭 GUIDANCE:` line once its section is written. This file answers "what are we building
> and for whom?" — keep it product-focused; technical detail belongs in architecture.md.

## About the Project

> 🧭 GUIDANCE: 2–4 sentences. What the app is, what it does, and the one capability that
> defines it. Should read like the answer you'd give a curious stranger.

{{ONE_TO_FOUR_SENTENCE_DESCRIPTION}}

---

## The Problem It Solves

> 🧭 GUIDANCE: What painful, repetitive, or impossible-today thing does this remove? Name the
> "before" and the "after".

{{PROBLEM_STATEMENT}}

---

## Pages

> 🧭 GUIDANCE: List the screens/routes and a one-line purpose each. If this isn't a multi-page
> app (CLI, API, mobile, extension), rename this section to fit — "Commands", "Endpoints",
> "Screens" — and list those instead.

```
{{ROUTE_OR_SCREEN}}    → {{PURPOSE}}
{{ROUTE_OR_SCREEN}}    → {{PURPOSE}}
```

---

## Navigation

> 🧭 GUIDANCE: How does the user move through the app? Nav model, layout shape. Omit if not
> applicable.

{{NAVIGATION_MODEL}}

---

## Core User Flow

> 🧭 GUIDANCE: The most important section. Walk the primary journey end to end, concretely —
> what the user sees, does, and gets back at each step. Use sub-headings per stage. Be
> specific enough that someone could build a clickable prototype from this alone.

### {{STAGE_NAME}}

{{WHAT_HAPPENS_STEP_BY_STEP}}

---

## Data Architecture

> 🧭 GUIDANCE: Describe the core data the app revolves around — the concept, where it lives,
> and what is allowed to change it. Detailed schema lives in architecture.md; here capture the
> idea and the ownership rules.

{{CORE_DATA_DESCRIPTION}}

---

## Features In Scope

> 🧭 GUIDANCE: The v1 feature list. Confirm each is truly v1. If in doubt, it goes to
> out-of-scope.

- {{FEATURE}}
- {{FEATURE}}

---

## Features Out of Scope

> 🧭 GUIDANCE: Just as important as in-scope. Everything explicitly deferred. This stops the
> build agent from gold-plating. Push borderline items here.

- {{DEFERRED_FEATURE}}
- {{DEFERRED_FEATURE}}

---

## Target User

> 🧭 GUIDANCE: Who exactly is this for? Describe them by what they do and need, not
> demographics.

{{TARGET_USER_DESCRIPTION}}

---

## Success Criteria

> 🧭 GUIDANCE: How will you know v1 works? Concrete, observable outcomes — not aspirations.

- {{SUCCESS_CRITERION}}
- {{SUCCESS_CRITERION}}
