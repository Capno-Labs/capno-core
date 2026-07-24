# Capno — guide for AI agents and new contributors

Capno is an anesthesia simulation lab PWA: a faculty controller drives a
simulated patient monitor in real time; students watch a mirrored monitor;
sessions end in a scored, printable debrief. Read `README.md` for
architecture. This file is the working contract for changing the code:
prefer extending the existing patterns (zustand stores, adapter
interfaces, zod at the boundaries) over inventing new ones.

**Naming.** Company: Capno Labs LLC. Brand: CAPNO. The app is **CAPNO
Studio** — the only branded name; its parts use plain descriptive names
(the student monitor, the case library and editor, the debrief). Don't
reintroduce module brand names — the old "CAPNO Rounds/Cases/Debrief" are
retired. All-caps CAPNO only in the product name, plain "Capno" in prose.
Display names only: routes, package names, and `capno:*` storage
keys/channel names stay lowercase and unchanged.

## Verify every change

```bash
npm test            # vitest: engine, scoring, schema + every scenario file
npm run lint        # CI runs it too
npm run typecheck   # tsc --noEmit
npm run build       # production build must pass
```

Never commit with failing checks. For anything touching sync, the monitor,
or the controller, also verify at runtime — the `verify` skill
(`.claude/skills/verify/SKILL.md`) has the canonical browser smoke flow
and Playwright selectors.

## Invariants — do not break these

If a requirement seems to force breaking one of these, stop and ask the
maintainer instead of working around it.

1. **`src/lib/engine/` stays framework-free.** No React, Next, zustand, or
   browser-only APIs (except types). It is the Apache-2.0 core and must run
   in Node (the tests do). UI behavior goes in components or stores.
2. **`types.ts` and `schema.ts` move together.** `types.ts` is the source of
   truth for shapes; `schema.ts` (zod) must mirror it exactly —
   `schema.test.ts` validates every scenario against it. If you change
   either, update: the other one, `docs/scenario.schema.md`, every file in
   `src/scenarios/`, the editor's `blankScenario()`, and the
   `SCHEMA_REFERENCE` prompt constant in `src/lib/llm/generator.ts`.
3. **One authority per session.** Exactly one authoritative engine instance
   drives a session (today: the browser `controllerStore`) — never a second
   tick loop. Student displays render broadcast snapshots and send nothing
   except `hello` — no student→faculty mutations of simulation state.
4. **Snapshots stay JSON-serializable.** No Dates, Maps, functions, or class
   instances in `SimSnapshot` — a test enforces round-tripping, and both the
   sync channel and localStorage archive depend on it.
5. **Offline-first.** No feature may require network when unconfigured.
   Supabase stays behind `supabaseConfigured()`; LLM features
   (`src/lib/llm/`) stay behind `llmConfigured()`/`useLlmConfigured()` —
   unconfigured means zero AI affordances rendered and zero network calls.
   Bundled scenarios are statically imported — never fetched.
6. **No new heavy dependencies without strong reason.** PDF export is print
   CSS on purpose; waveforms are hand-drawn canvas on purpose. Do not add
   jsPDF, chart libraries, or UI kits for incremental work.
7. **Clinical content must be source-verified.** Do not invent or "correct"
   drug doses, treatment sequences, or physiology numbers in scenarios from
   your own judgment or memory. If a change requires clinical content,
   verify it against trusted published sources (peer-reviewed literature,
   standard anesthesia texts, or professional-society guidelines), copy
   structural patterns from the existing scenarios, and cite the
   sources you used in your PR description (and in `docs/curriculum.md`).
8. **Safety text stays.** "Simulation only — not for clinical use"
   disclaimers (home page, debrief report, README) must not be removed. The
   faculty PIN is advisory, not security — never describe it otherwise.

## Where features belong (open core vs. hosted)

This repo is the complete, self-hostable simulator; Capno Labs builds a
hosted product on top of it, consuming this core unmodified. The placement
test:

- **Here:** value realized inside a single session on one lab setup —
  engine physiology, monitor fidelity, scenario authoring, the session
  debrief, local archives, offline operation.
- **Hosted layer, not here:** value across sessions, learners, or an
  organization (cohort analytics, longitudinal records, LMS/LTI, SSO), or
  anything requiring an operated service.
- **Extension points are welcome here:** config gates like
  `supabaseConfigured()`, adapter interfaces (`SyncChannel`), metadata
  fields the hosted layer builds on.
- **No clawbacks:** anything already shipped in this repo stays free —
  scope is enforced by declining to add, never by removing.

Where new curriculum ships is a maintainer placement decision — for
anything beyond fixes to the bundled scenarios, open an issue before
writing content. If a request sits on the boundary, ask the maintainer
instead of guessing in either direction.

## Known traps

- `schema.test.ts` asserts an **exact count** of built-in scenarios.
  Adding one requires: the JSON file, a static import in
  `src/lib/scenarios/registry.ts`, and updating that test's count + id list.
- BroadcastChannel only spans tabs of the **same browser profile on the same
  machine**. Cross-device sync needs Supabase env vars — don't chase
  "sync is broken" reports without checking which transport is in play.
- The tick interval lives in `controllerStore.loadScenario`. It's a
  module-level singleton (one session per device by design). `teardown()`
  must clear it — leaking intervals shows up as double-speed clocks.
- localStorage keys are versioned (`capno:sessions:v1`,
  `capno:custom-scenarios:v1`, `capno:collections:v1`, `capno:cloud-outbox:v1`,
  `capno:cloud-sync-meta:v1`, `capno:llm-settings:v1`, `capno:demo:v1`,
  `capno:monitor-sound:v1`). If you change a stored shape, add a new
  versioned key and migrate; don't mutate the old shape in place
  (`legacyStorage.ts` migrates the old `labsim:*` keys).
- The LLM co-pilot never gets new engine surface: it emits `CopilotCommand`s
  that are validated/clamped in `src/lib/llm/copilot.ts` and applied through
  existing `controllerStore` actions only (propose + confirm — the faculty
  controller stays the single authority). Session lifecycle
  (start/pause/reset/end) is deliberately not LLM-controllable.
- AI-generated scenario drafts carry an `ai-generated` topic tag (see
  invariant 7 — clinical content is reviewed material). Don't strip the tag
  programmatically; reviewers remove it in the editor after review.
- In the editor, the JSON pane is the source of truth only after
  "Apply JSON"; form edits regenerate the JSON text. Preserve that
  direction or you'll create silent data loss.
- All pages are client components (`'use client'`) — the app is
  local-first and stateful. Don't convert to server components.
- Changing caching behavior requires bumping `VERSION` in `public/sw.js`.
- Icons are generated — edit `scripts/gen-icons.mjs` and run
  `npm run icons`; never hand-edit the PNGs.
- Vitest runs in a Node environment — tests must not touch DOM. Pure logic
  is unit-testable even in component dirs (e.g. `waveforms.test.ts`);
  rendering is verified via the build and the `verify` skill.
- Vitals history (`engine.getHistory()`) is archive-only. Never add it to
  `SimSnapshot` — snapshots broadcast twice a second and history would bloat
  every message (it's why `ArchivedSession.history` is a separate field).
- In NIBP cuff mode (the default), displayed BP and BP alarms come from
  `snapshot.nibp` (last measured), not live values. Only artLine scenarios
  show live pressure. Don't "fix" a stale NIBP tile — the staleness is the
  teaching point.

## Extending

Step-by-step recipes for common changes — add a scenario, numeric vital,
rhythm, or sync transport; touch cloud sync or scoring — live in the
`extending` skill (`.claude/skills/extending/SKILL.md`).
