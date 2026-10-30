# Worked example: the intake on a multi-repo system

A concrete run of the [existing-project intake](../plugin/skills/start-project/references/intake-existing.md)
against a multi-surface system: **Trailhead**, a fictional fitness product at `~/code/trailhead/`.

This shows *how the intake plays out*, not a spec for any real system. The findings below are
illustrative. The real ones come out of the actual run.

You start it with `npx pantoo-ai new --existing --multi-surface`, then run `/pantoo:start-project`
in the primary repo. The `--multi-surface` flag adds `context/contracts.md`.

---

## The system

```
~/code/trailhead/
├── trailhead/                   ← Nx monorepo
│   ├── apps/
│   │   ├── api/                 ← NestJS, main backend
│   │   ├── api-management/      ← NestJS, management API
│   │   ├── api-realtime/        ← realtime backend
│   │   ├── management/          ← management web UI
│   │   ├── mobile/              ← React Native app
│   │   └── api-e2e/ · api-realtime-e2e/
│   ├── libs/shared/types/       ← shared types package
│   ├── packages/ · infra/ · tools/ · docs/
│   └── nx.json · docker-compose{,.dev,.prod}.yml
└── trailhead-cms/               ← Strapi
```

Five runtime surfaces across two repos, one content model, one brand rendered on both mobile
and web.

---

## Step 0: where the context folder goes

Two repos, one system. Put `context/` in the parent, and have each repo's `AGENTS.md` point at it:

```
~/code/trailhead/
├── context/              ← the shared context
├── trailhead/            ← AGENTS.md → "read ../context/ before any work"
└── trailhead-cms/        ← AGENTS.md → "read ../context/ before any work"
```

Keep `contracts.md` and `known-issues.md`: this system needs both.

**Why parent-level:** the CMS content model, the API that serves it, and the two clients that
render it are one contract. Split the context per repo and each copy is right in isolation and
wrong about the system, which is exactly the failure you're trying to prevent.

The tradeoff is real: a parent folder is outside either git repo. Either make `~/code/trailhead` a
repo of its own that contains both as submodules, or keep `context/` in `trailhead` (the primary
surface) and have `trailhead-cms/AGENTS.md` point at `../trailhead/context/`. **Decide this before
starting**, because it's annoying to move later. The second option is usually the pragmatic one.

---

## Phase 0: scope and recon

### The scoping conversation

The deciding question is *do these surfaces share a contract?* Here, obviously yes: a Strapi
content type is served by NestJS and rendered by both mobile and management. So scope is **the
whole system**, not one app.

But five surfaces is a lot to read at equal depth, so the intake proposes tiers and has you
confirm them:

| Surface | Proposed depth | Reason |
| --- | --- | --- |
| `apps/api` | Deep | Central: everything routes through it |
| `trailhead-cms` | Deep | Source of truth for content |
| `libs/shared/types` | Deep | The propagation spine: small and high-leverage |
| `apps/mobile` | Deep | Primary user surface |
| `apps/management` | Medium | Internal tool; conventions matter more than every screen |
| `apps/api-management` | Medium | Same stack as `api`; check where it diverges |
| `apps/api-realtime` | Medium-deep | Realtime events are a contract; the intake needs the event catalog even if not every handler |
| `*-e2e` | Skim | Read as *evidence of intended behavior*, not as code to document |
| `infra/`, `tools/` | Skim | Note what exists; deploy topology unless you say otherwise |

**Expect to be asked** which of these is where you actually spend your time, and whether
anything is dormant. If `api-management` hasn't been touched in eight months, that changes its
tier and possibly its state in `context/overview.md`.

### What recon exploits here

Nx makes this repo unusually legible, and the intake leans on it:

- **`nx.json` + project graph**: the real dependency graph between apps and libs, for free. No
  need to infer boundaries from imports when the tool states them.
- **`@nx/enforce-module-boundaries` in `eslint.config.mjs`**: if configured, these are
  *enforced* boundaries, the highest-confidence architecture facts in the repo. They go into
  `context/architecture.md` as observed, no confirmation needed.
- **`docker-compose*.yml`**: the actual service topology, including anything not in `apps/`
  (Postgres, Redis, storage). The dev/prod split shows what differs by environment.
- **`libs/shared/types`**: read early. Its contents tell you which contracts are already
  formalized; its *gaps* tell you which ones are hand-maintained.
- **`docs/`**: prior intent. Read it, then verify against code, and flag disagreements.
- **`tsconfig.base.json` path aliases**: the intended import surface of each lib.

### The gate

The intake writes a one-page "here's what I think Trailhead is" and stops until you confirm.
Read it carefully: five surfaces means five chances to have misread something, and every later
phase inherits it.

---

## Phase 1: product (`context/overview.md`)

The trap is writing five product descriptions. There's one product with five surfaces.

Expect questions that code can't answer:

- Who's the mobile user vs. the management user? (Two audiences, one product.)
- What's `api-management` for that `api` isn't? The split has a reason; it isn't in the code.
- Is content author-driven in Strapi, or is Strapi a config store someone chose for the admin UI?
  **This one materially changes the architecture read**, and it's genuinely ambiguous from
  outside.
- What's in the repo but dead? With five apps and e2e projects, something is dormant.

Features get states (`shipped` / `partial` / `stubbed` / `dead`), per surface, since a feature can
be shipped on mobile and stubbed in management.

---

## Phase 2: architecture as built (`context/architecture.md`)

The system map comes first, then per-surface stacks: five surfaces, five stack blocks. NestJS
and React Native don't flatten into one table.

Likely inconsistency sweeps, each of which gets challenged rather than noted:

- Do `api`, `api-management` and `api-realtime` share auth, error shape and config loading, or
  has each grown its own?
- Does mobile talk only to `api`, or does it reach `api-realtime` directly? Does anything talk
  to Strapi directly, bypassing `api`?
- Do the three NestJS apps use the same ORM and version, validation approach and module structure?

That last one produces a classic exchange:

> **Found:** `api` uses `class-validator` DTOs on every controller. `api-management` validates
> inline in 6 of 11 handlers and not at all in the other 5. `api-realtime` doesn't validate
> event payloads.
>
> **Cost:** unvalidated input on internal surfaces, and no rule for the build agent to follow.
>
> **Recommendation:** `class-validator` DTOs everywhere; the gaps become known debt.
>
> **Is there a reason realtime skips it, such as throughput?**

That last question matters. There may be a real answer, and it becomes documented rationale
rather than debt.

**Invariants** come from the fear question ("what would scare you if it broke?"). For a system
like this they'll be things like: mobile never talks to the CMS directly; no surface writes to
another's tables; realtime never becomes the source of truth for persisted state.

---

## Phase 3: contracts (`context/contracts.md`)

**This is the phase that makes a CMS change propagate correctly.** Everything else is
documentation.

### Contracts the intake should find

| Contract | Likely source of truth | Consumers |
| --- | --- | --- |
| Content types | `trailhead-cms` Strapi schemas | `api` → mobile, management |
| DB schema / entities | `apps/api` migrations or entities | api, api-management |
| REST/GraphQL surface | `apps/api` controllers | mobile, management |
| Management API surface | `apps/api-management` | management |
| Realtime events | `apps/api-realtime` | mobile, management |
| Shared types | `libs/shared/types` | potentially all |
| Design tokens | `{{TBD: where they live, often nowhere}}` | mobile, management |
| Auth/token claims | `apps/api` | every surface |

### The questions that matter

**Is `libs/shared/types` actually the spine, or does it just exist?** The intake greps for
whether mobile and management import from it or define their own copies. A shared types package
that surfaces bypass is worse than none, because it looks solved. This is the single highest-value
check in the whole intake.

**Are Strapi types generated or hand-written?** Strapi can emit TS types. If nobody wired that
up, every content change is a manual sync across `api` → types → mobile → management: four
manual links, all silent failures. If it *is* wired, the checklist is short and safe.

**Which surfaces read content fields directly?** The propagation risk is exactly proportional to
how many places name the field.

### What the checklist looks like

Built from your account of the last real content change, not from inference:

> **Adding a field to a content type**
>
> 1. Add the field in Strapi (`trailhead-cms/src/api/{{type}}/content-types/…`)
> 2. Run the CMS type export → `{{command}}` *(if not wired, this is the manual gap)*
> 3. Update the type in `libs/shared/types/…`: **fails silently if skipped**
> 4. Update the `api` DTO/serializer, or surfaces won't see the field
> 5. Mobile: `apps/mobile/…`: check the display component **and** any local cache/persistence schema
> 6. Management: `apps/management/…`: table columns and edit form
> 7. If realtime broadcasts this entity, update the event payload in `apps/api-realtime`
> 8. **Verify:** `nx affected -t build,test` catches typed consumers. It will **not** catch
>    untyped access, cached shapes, or older mobile builds in the wild.

Step 8's second sentence is the kind of thing this file exists for. `nx affected` gives real
confidence for derived links and *none* for manual ones, and knowing which is which is the whole
game.

---

## Phase 4: design as built (`context/ui/`)

The gate question: **should mobile and management look like one product?**

Plausibly no: a consumer fitness app and an internal admin tool have different jobs. If so, the
intake stops treating divergence as debt and documents two token sets, sharing only brand
primitives. If yes, every divergence is debt.

Either way, expect token extraction per surface and then a diff, with near-matches flagged as
the tell. React Native and web don't share a styling mechanism, so if tokens *should* be shared
the intake will find there's no mechanism to share them. That's a `context/contracts.md` entry,
not just a note.

`context/ui/registry.md` gets a surface column and covers both `mobile` and `management`.

---

## Phase 5: standards (`context/standards.md`, `context/libraries.md`)

Nx helps again: root `eslint.config.mjs` and `tsconfig.base.json` are shared and enforced.
They're observed facts, straight into `context/standards.md`. Then per-app overrides show where
surfaces genuinely diverge.

Structure: shared rules first, then a section per surface. The challenge is on differences with
no platform reason. Three NestJS apps with three different test setups is drift; React Native
using a different navigation library than the web UI is not.

`context/libraries.md` pins to the lockfile versions. Strapi and NestJS both have sharp
major-version differences, so this matters more than usual. Use ctx7 with the locked version.

---

## Phases 6 and 7: debt and verification

**`context/known-issues.md`** will be substantial. Every manual propagation link from Phase 3
lands here as a standing risk, plus contract drift, plus whatever the inconsistency sweeps turned
up.

**Verification** (Phase 7) does a dry run of one propagation checklist against the code. A
checklist that skips a step is worse than no checklist, because it will be trusted.

**The roadmap** is not part of the intake. Run `/pantoo:plan-roadmap` afterwards. It starts with
the question of whether you want anything built at all. If the goal is just documentation, it
says so rather than inventing a roadmap. If Phase 3 found manual propagation gaps, "wire up CMS
type generation" is a strong first slice in `context/roadmap.md`: it converts four silent manual
links into build-time failures, which is worth more than most features.

---

## What this buys you

Afterwards, an agent working in `trailhead-cms` reads `context/contracts.md`, sees that a content
type has four downstream consumers, and either follows the checklist or tells you what it can't
reach. A CMS change that doesn't go everywhere becomes a documented checklist instead of
something you have to remember.

The intake is also where you find out how many of those links are manual. That number is the
real health metric for a system like this, and most teams have never counted it.

---

## Practical notes

- **Budget the time.** Five surfaces at mixed depth is a multi-session intake. Phases 0 to 3 are
  the high-value core; if you stop after Phase 3 you already have the propagation map. Each
  confirmed phase is on disk, so `/pantoo:start-project` resumes at the first unfinished one.
- **Phase 3 is the one to insist on.** Skipping the design phase costs you consistency.
  Skipping contracts costs you the thing a multi-surface system needs most.
- **Answer "I don't remember" honestly.** It routes to `git blame`, which is often faster than
  recalling, and an honest unknown becomes a `{{TBD: …}}` rather than a confident wrong answer.
- **Re-run it after big changes.** A retrofit is a snapshot. `context/known-issues.md` records
  the commit SHA it covers, so the next reader knows how much to trust it.
