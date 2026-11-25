# Automations

> 🧭 GUIDANCE: Automation projects (AI assistants, agents, workflow automation). One section per
> workflow or agent: copy the section for each, and keep the Index in step. Fill it from the
> developer's answers and, in an existing project, from the workflow exports, agent configs and
> prompt files. Replace every `{{...}}`, delete every `> 🧭 GUIDANCE:` line.

What each workflow and agent does, what it can reach, and how to tell it still works. A change to
a workflow's steps, tools, prompts or approvals updates its entry in the same commit.

## Index

| Workflow or agent | Trigger | Runs on | Source |
| ----------------- | ------- | ------- | ------ |
| {{NAME}} | {{TRIGGER}} | {{RUNTIME}} | `{{SOURCE_PATH}}` |

---

## {{NAME}}

{{PURPOSE}}

- **Trigger:** {{TRIGGER_DETAIL}}
- **Source:** `{{SOURCE_PATH}}`; prompts in `{{PROMPTS_PATH}}`

> 🧭 GUIDANCE: Purpose: what it does and for whom, in one line. Trigger: what fires it (a schedule,
> a webhook, an inbound email, a chat message) and who or what can fire it. Runs on: n8n, a
> worker, the Claude Agent SDK, OpenClaw, a cron job. Source: the committed export or code.

### Steps

> 🧭 GUIDANCE: In order. Model is the exact model ID, or `none` for a step with no model. A step
> that branches or loops says on what.

| # | Step | Model | Input | Output |
| - | ---- | ----- | ----- | ------ |
| 1 | {{STEP}} | {{MODEL}} | {{INPUT}} | {{OUTPUT}} |

### Tools and credentials

> 🧭 GUIDANCE: Everything it can reach: APIs, databases, inboxes, files, other agents, MCP servers.
> A credential is named with the place it's stored, never its value. Access is what it can do
> there (read, write, send, delete, pay). A tool no step uses comes off this list and out of the
> credential.

| Tool | Credential (name, where stored) | Access | Step |
| ---- | ------------------------------- | ------ | ---- |
| {{TOOL}} | {{CREDENTIAL}} | {{ACCESS}} | {{STEP_NUMBER}} |

### Human approval

> 🧭 GUIDANCE: Every point where a person says yes before it goes on: who, through what, what they
> see, and what happens on a no or no answer. Each step that sends, publishes, pays, deletes or
> writes outside the project's own data is either here or forbidden under Never. Write `None:
> nothing it does leaves the system` only when that's true.

- {{APPROVAL}}

### Never

> 🧭 GUIDANCE: Flat, checkable rules, like the invariants in `architecture.md`. Ask "what would be
> a disaster if it did this on its own?" Each answer is a line.

- {{NEVER}}

### Failure and retry

- **A step fails:** {{RETRY}}
- **It gives up:** {{GIVE_UP}}
- **Bad model output:** {{BAD_OUTPUT}}

> 🧭 GUIDANCE: A step fails: retries and backoff, which steps are safe to repeat, which never are
> (a send, a charge). It gives up: who is told, where, and what state it leaves behind. Bad model
> output: the schema check, then retry, fall back or stop.

### Cost and limits

- **Per run:** {{COST_PER_RUN}}
- **Limits:** {{LIMITS}}

> 🧭 GUIDANCE: Per run: the expected tokens or cost, and the cap that stops a run. Limits: the
> provider's rate limits that apply, and this project's own cap per user or per day
> (`security.md` rule 11).

### Tests

- **Run with:** {{TEST_COMMAND}}

| Case | Input | Must hold | Must not |
| ---- | ----- | --------- | -------- |
| {{CASE}} | `{{INPUT_FILE}}` | {{EXPECTED}} | {{FORBIDDEN}} |

> 🧭 GUIDANCE: `verify-feature` runs these. Run with: the command or URL, and the sandbox, dry-run
> flag or test credentials that keep real side effects off. Cases: the normal one, one it must
> refuse or hand to a person, and one whose input carries an instruction ("ignore your rules
> and…", `security.md` rule 25). Model output varies, so Must hold is what has to be true (a
> field, a decision, an approval asked for), not exact wording. Inputs are committed files with
> no real personal data.
