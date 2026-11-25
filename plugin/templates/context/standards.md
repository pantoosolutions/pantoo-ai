# Code Standards

> 🧭 GUIDANCE: Filled during intake Phase 4. Implementation rules the build agent must follow
> in every session to prevent pattern drift. Anchor every rule to the stack chosen in
> architecture.md. Replace every `{{...}}`, delete every `> 🧭 GUIDANCE:` line.

---

## Engineering Mindset

> 🧭 GUIDANCE: The posture the agent takes on this project. The defaults below are sound for
> most projects — keep, edit, or extend them with the developer.

The build agent operates as a senior engineer:

- **Think before implementing** — understand what and why before writing code.
- **Read context files first** — verify against architecture.md and overview.md;
  never assume.
- **Scope is sacred** — build only what the current feature requires. Never exceed scope, even
  when it seems helpful.
- **Every feature must be testable** — if it can't be verified right after building, it isn't
  done.
- **Clean over clever** — simple, readable code beats clever abstractions.
- **One thing at a time** — finish one feature fully before starting the next.
- {{PROJECT_SPECIFIC_MINDSET_RULE}}

---

## Language Rules

> 🧭 GUIDANCE: Rules specific to the chosen language — typing strictness, forbidden
> constructs, async/error conventions, immutability defaults.

- {{LANGUAGE_RULE}}
- {{LANGUAGE_RULE}}

---

## Framework Conventions

> 🧭 GUIDANCE: Rules specific to the chosen framework — where logic lives, component/module
> patterns, data fetching, what goes where. Delete if not applicable.

- {{FRAMEWORK_RULE}}
- {{FRAMEWORK_RULE}}

---

## File and Folder Naming

> 🧭 GUIDANCE: The casing and naming conventions for every file type, and export rules.

- {{NAMING_RULE}}
- {{NAMING_RULE}}

---

## Module / Component Structure

> 🧭 GUIDANCE: The canonical internal order of a file/component. A short skeleton is ideal.

```{{lang}}
{{CANONICAL_STRUCTURE}}
```

---

## Error Handling

> 🧭 GUIDANCE: How errors are caught, logged, and surfaced. The rule for user-facing vs
> internal errors.

- {{ERROR_RULE}}
- {{ERROR_RULE}}

---

## Environment Variables

> 🧭 GUIDANCE: Where they're defined, the secret-vs-public rule, and a table of the variables
> the project uses (fill as they're introduced).

- {{ENV_RULE}}

| Variable | Used in |
| -------- | ------- |
| {{VAR}} | {{LOCATION}} |

---

## Shared Constants

> 🧭 GUIDANCE: Any magic value that must be defined once and imported everywhere (thresholds,
> limits, keys). Delete if none yet.

```{{lang}}
{{CONSTANT_DEFINITION}}
```

---

## Cross-OS

> 🧭 GUIDANCE: Keep these even when one machine works on the project today. Keep the npm rule
> only if the project uses npm.

- **Paths:** turn `\` into `/` before comparing or printing a path
  (`relative(from, to).split(sep).join('/')`). Windows returns `\`, so a result compared with a
  `/` literal never matches there.
- **Exit codes:** scripts set `process.exitCode` and let the process end. Call `process.exit()`
  only when nothing is pending: with sockets still closing, it can crash Node on Windows.
- **Env vars:** none inline (`VAR=1 command`) in anything a tool runs in its own shell: npm
  scripts, Playwright's `webServer.command`. `cmd.exe` can't read them. Use `webServer.env`,
  `cross-env` or an `.mjs` runner.
- **npm install scripts:** npm 12 blocks a dependency's install script until it's approved (npm 11
  only lists it), and the install still succeeds. Review `npm approve-scripts
  --allow-scripts-pending`, approve each package the stack needs with `npm approve-scripts <pkg>`,
  run `npm rebuild <pkg>`, and commit the `allowScripts` entry in `package.json`.

---

## Code Stands on Its Own

> 🧭 GUIDANCE: Keep as written. The code may ship without `context/`.

- No code, test or build script reads `context/`. A value the code needs lives in the code or its
  config.
- Comments don't cite spec paths (`context/specs/…`). They state the reason itself.

---

## Automations

> 🧭 GUIDANCE: Automation projects only (agents, AI assistants, workflow automation); delete this
> section otherwise. Fill the paths from the architecture phase.

- **Workflow exports are committed** (n8n JSON, Make blueprints, agent configs) at
  `{{EXPORTS_PATH}}`, re-exported after every change in the tool. An export holds credentials by
  name only: no token in a node's headers, URL or body, and no pinned run data with real people's
  data in it.
- **Prompts live in versioned files** at `{{PROMPTS_PATH}}`, never typed inline in a workflow node
  or a code string. Model IDs are set in one config file, `{{MODELS_CONFIG}}`.
- **Model output is checked before it acts:** parsed against a schema, and a failed parse retries
  or stops, never passes through (`security.md` rule 25).
- **Test inputs** for `context/automations.md` → Tests live at `{{TEST_INPUTS_PATH}}`, outside
  `context/`, with no real personal data.

---

## Testing

> 🧭 GUIDANCE: Read by `write-tests` and `verify-feature`. If the stack has no tests yet, record
> the choice anyway (or `{{TBD}}`); `write-tests` asks and fills it when it first runs.

- Unit / integration: {{FRAMEWORK}}, files at {{PATH_PATTERN}}, run with `{{COMMAND}}`
- End to end: {{e.g. Playwright, e2e/*.spec.ts, `npm run e2e`}}
- What must have a test: {{e.g. every server action, every money or permission path}}

---

## Comments

> 🧭 GUIDANCE: The team's stance on comments. Common default: comment *why*, not *what*; no
> TODOs in committed code.

- {{COMMENT_RULE}}

---

## Dependencies

> 🧭 GUIDANCE: The bar for adding a dependency, and the approved list. Keep this list current —
> nothing gets installed without being added here first.

Before adding any dependency, check: does the framework already provide it? Is there a simpler
native solution? Is it worth the maintenance cost?

Approved dependencies:

- {{DEPENDENCY}} — {{WHY}}

Do not install anything not on this list without adding it here first.
