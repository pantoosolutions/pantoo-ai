# Library Docs

> 🧭 GUIDANCE: Filled during intake Phase 4. One section per third-party library named in
> architecture.md, describing HOW THIS PROJECT uses it — not generic docs. Replace every
> `{{...}}`, delete every `> 🧭 GUIDANCE:` line. Keep the "order of authority" preamble below.

Project-specific usage patterns for every third-party library in this project. This file covers
how we use each library *here* — the rules, patterns, and constraints specific to this codebase.

Read the relevant section before implementing any feature that touches these libraries.

---

## Before Using Any Library

Before implementing any feature that uses a third-party library:

1. **Check for an installed skill** (e.g. in AGENTS.md or the project's skill list) for that
   library. Skills carry up-to-date, project-relevant API docs and patterns.
2. **Check for a configured MCP server** for that library — if present, use it for live docs
   and debugging before falling back to general knowledge.
3. **Read this file** for the project-specific patterns that override general knowledge.

Order of authority:

```
MCP server (real-time docs) → Skills → This file (project rules) → General training knowledge
```

Never rely on training knowledge alone for library APIs — they change frequently and training
data may be stale.

---

> 🧭 GUIDANCE: Duplicate the block below once per library. For each, note whether a skill or
> MCP server exists for it, then capture the concrete patterns the developer wants — client/
> server split, initialization, the canonical call shapes, and the gotchas. Use real code.

## {{LIBRARY_NAME}}

**Check first:** {{Skill / MCP availability note for this library}}

### {{Usage area — e.g. Initialization / Queries / Calls}}

```{{lang}}
{{CANONICAL_USAGE_SNIPPET}}
```

**Rules:**

- {{PROJECT_SPECIFIC_RULE}}
- {{PROJECT_SPECIFIC_RULE}}

---

<!-- Repeat the section above for each library. -->
