# Architecture

> 🧭 GUIDANCE: Filled during intake Phase 3. This file decides the stack and the hard rules.
> Replace every `{{...}}`, delete every `> 🧭 GUIDANCE:` line. No stack is assumed — every
> choice here comes from the intake conversation.

## Stack

> 🧭 GUIDANCE: One row per layer the project actually uses. Add or remove rows to fit. For
> each, the "why" should be a real reason, not a default.

| Layer | Tool | Purpose |
| ----- | ---- | ------- |
| Platform / shape | {{web / api / cli / mobile / desktop / extension}} | {{WHY}} |
| Language | {{LANGUAGE}} | {{WHY}} |
| Framework | {{FRAMEWORK}} | {{WHY}} |
| Backend / data | {{BACKEND}} | {{WHY}} |
| Auth | {{AUTH}} | {{WHY}} |
| Storage | {{STORAGE}} | {{WHY}} |
| Styling / UI | {{UI_SYSTEM}} | {{WHY}} |
| {{OTHER_SERVICE}} | {{TOOL}} | {{WHY}} |

---

## Folder Structure

> 🧭 GUIDANCE: Propose a concrete structure that fits the chosen stack and the pages/features
> from overview.md. Annotate non-obvious files with `→ purpose`. Keep it real — only
> folders the project will actually have.

```
{{PROJECT_ROOT_TREE}}
```

---

## System Boundaries

> 🧭 GUIDANCE: One row per top-level folder/module: what it owns and what it must never do.
> These feed the invariants at the bottom.

| Folder | Owns |
| ------ | ---- |
| {{FOLDER}} | {{WHAT_IT_OWNS_AND_FORBIDS}} |

---

## Data Flow

> 🧭 GUIDANCE: Trace the primary operations end to end as simple step diagrams. One block per
> distinct kind of operation (e.g. a user mutation, a background job, an external API call).

### {{OPERATION_NAME}}

```
{{STEP}}
   ↓
{{STEP}}
   ↓
{{STEP}}
```

---

## Data Model

> 🧭 GUIDANCE: Tables / collections / core types with their fields and notes. Tie back to the
> "core data" concept from overview.md. Use whatever shape fits the backend (SQL
> tables, document collections, type definitions). One block per entity.

### `{{ENTITY_NAME}}`

| Field | Type | Notes |
| ----- | ---- | ----- |
| {{field}} | {{type}} | {{notes}} |

---

## Storage

> 🧭 GUIDANCE: If the app stores files/blobs, describe buckets/paths and access rules. Delete
> this section if not applicable.

| Location | Path | Contents | Access |
| -------- | ---- | -------- | ------ |
| {{BUCKET}} | {{PATH}} | {{CONTENTS}} | {{ACCESS_RULE}} |

---

## Authentication

> 🧭 GUIDANCE: Provider(s), methods, which surfaces are protected vs public, where the check
> happens. Delete if the app has no auth.

- Provider: {{AUTH_PROVIDER}}
- Methods: {{METHODS}}
- Protected: {{PROTECTED_SURFACES}}
- Public: {{PUBLIC_SURFACES}}
- Enforcement: {{WHERE_THE_CHECK_LIVES}}

---

## Key Patterns

> 🧭 GUIDANCE: Capture any setup/usage pattern the agent must follow exactly — client
> initialization, the shape of a service call, a session lifecycle. Code snippets welcome.
> Add one block per pattern; delete the section if there are none yet.

### {{PATTERN_NAME}}

```{{lang}}
{{CANONICAL_SNIPPET}}
```

---

## Invariants

> 🧭 GUIDANCE: The highest-leverage part of this file. Flat, checkable rules the build agent
> must never violate, derived from the boundaries and data model. Each one should be a single
> unambiguous sentence. Ask the developer: "what would scare you if it silently broke?"

- {{INVARIANT}}
- {{INVARIANT}}
