# Build approaches

Read only the section for the principle you picked, and slice the roadmap the way it says.

## Tracer bullet

Prove the whole pipe connects before building any part of it fully.

- First feature slice: the thinnest real path through the core loop, touching every layer (data,
  logic, interface, UI) and working end to end. It is the walking skeleton; don't plan a separate one.
- Real from that slice on: auth, the schema and its migration, the core write and read path, a
  usable UI for exactly that path. Nothing faked; only breadth is cut.
- Each later slice thickens one segment, still end to end: invitations, templates, history,
  search, admin.
- Grade: production, narrow.

## Skateboard

Ship the thinnest usable whole first, then grow it.

- First slice: the smallest version a user would actually use for the core value, even if crude.
  Every later slice makes the whole thing better, never one part perfect.
- Defer everything the core value doesn't need on day one; cut features, not quality.
- Fits fast validation of one core loop with real users.

## UI-first with mock data

A clickable shell on placeholder data first, then wire the back end.

- First slices: the screens and navigation, on mock data shaped like the real model.
- Then one slice per data area that replaces the mocks with real reads and writes.
- Migrations and auth come with the wiring slices, not before.
- Grade: prototype until wired. Say so; it demos fast but isn't production.

## Journey

Finish one complete user path end to end per phase.

- Each phase is one journey (sign up → first project → invite a teammate), built fully, edge
  cases included, before the next journey starts.
- Fits products whose experience or funnel is the product.
- Shared pieces a later journey needs are built in the first journey that needs them, not up front.
