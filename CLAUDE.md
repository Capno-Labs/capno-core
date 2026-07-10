# Capno — guide for AI agents and new contributors

Capno is an anesthesia simulation lab PWA: a faculty controller drives a
simulated patient monitor in real time; students watch a mirrored monitor;
sessions end in a scored, printable debrief. Read `README.md` for
architecture. This file is the working contract for changing the code.

**Naming.** Company: Capno Labs LLC. Brand: CAPNO. The app/platform is
**CAPNO Studio** — the only branded name. Its parts use plain descriptive
names: the **student monitor** (`/student`), the **case library** and
**case editor** (`/scenarios`, `/editor`), and the **debrief** / past
sessions (`/debrief`). Do not reintroduce module brand names (the old
"CAPNO Rounds/Cases/Debrief" are retired). Use all-caps CAPNO only in the
product name, plain "Capno" in prose. Display names only — routes, package
names, and `capno:*` storage keys/channel names stay lowercase and
unchanged.

## Verify every change (non-negotiable)

```bash
npm test            # 22+ unit tests: engine, scoring, schema + all scenario files
npm run typecheck   # tsc --noEmit
npm run build       # production build must pass
```

Run all three before every commit. For anything touching sync, the monitor,
or the controller, also verify by hand: `npm run dev`, open
`/faculty/run/anaphylaxis` in one tab, copy the 4-char session code, open
`/student` in a second tab, join, press Start, and confirm the student
monitor ticks and reacts to a slider change and an event.

## Invariants — do not break these

1. **`src/lib/engine/` stays framework-free.** No React, Next, zustand, or
   browser-only APIs (except types). It is the Apache-2.0 core and must run
   in Node (the tests do). If you need UI behavior, put it in components or
   stores.
2. **`types.ts` and `schema.ts` move together.** `types.ts` is the source of
   truth for shapes; `schema.ts` (zod) must mirror it exactly. If you change
   either, update: the other one, `docs/scenario.schema.md`, every file in
   `src/scenarios/`, the editor's `blankScenario()`, and the
   `SCHEMA_REFERENCE` prompt constant in `src/lib/llm/generator.ts`.
3. **One authority per session.** Faculty authority is the principle; the
   browser `controllerStore` is today's implementation of it. Exactly one
   authoritative engine instance drives a session — a server-authoritative
   host (see the README roadmap) may take that role *instead* someday, but
   never alongside it, and never as a second tick loop for the same session.
   Student displays render broadcast snapshots and send nothing except
   `hello` — no student→faculty mutations of simulation state. Session
   *metadata* recorded on the faculty side (e.g., a learner roster attached
   to a session and its archive) is compatible with this invariant; learner
   input through the student display is not.
4. **Snapshots stay JSON-serializable.** No Dates, Maps, functions, or class
   instances in `SimSnapshot` — a test enforces round-tripping, and both the
   sync channel and localStorage archive depend on it.
5. **Offline-first.** No feature may require network by default. Supabase is
   optional and must stay behind `supabaseConfigured()` checks; LLM features
   (`src/lib/llm/`) are optional and must stay behind `llmConfigured()` /
   `useLlmConfigured()` — unconfigured means zero AI affordances rendered and
   zero network calls. "By default" means *unconfigured*: a deployment that
   ships pre-configured (e.g., a hosted build providing Supabase and an LLM
   gateway through env vars) is a legitimate state of this same code, not a
   violation. The requirement is that the code paths stay optional — not
   that no build may enable them. Bundled scenarios are statically
   imported — never fetched.
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

Capno is an open-core project: this repo is the complete, self-hostable
simulator; Capno Labs builds a hosted product on top of it (consuming this
core unmodified) that adds organization-level services. The placement test:

- **Belongs here:** value realized inside a single session on one lab
  setup — engine physiology, monitor fidelity, scenario authoring, the
  debrief for that session, local archives, offline operation.
- **Belongs in the hosted layer, not here:** value that emerges across
  sessions, learners, or an organization (cohort/institution analytics,
  longitudinal learner records, LMS/LTI, SSO), or that requires an operated
  service (managed hosting, managed LLM keys, a curated content library).
- **Extension points belong here and are welcome:** config gates like
  `supabaseConfigured()`/`llmConfigured()`, adapter interfaces
  (`SyncChannel`), and metadata fields the hosted layer builds on. Build
  the socket in core; the premium bulb goes elsewhere.
- **No clawbacks:** anything already shipped in this repo stays free.
  Scope is enforced by declining to *add* out-of-scope features, never by
  removing or degrading what exists.

These rules (and the invariants above) govern this repository only — the
hosted layer makes its own dependency and UI choices. If a request sits on
the boundary, stop and ask the maintainer (see Working style) instead of
guessing in either direction.

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
  `capno:custom-scenarios:v1`, `capno:cloud-outbox:v1`,
  `capno:cloud-sync-meta:v1`, `capno:llm-settings:v1`). If you change a
  stored shape, add a new versioned key and migrate; don't mutate the old
  shape in place (`legacyStorage.ts` migrates the old `labsim:*` keys).
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
- Vitest runs in a Node environment. Engine tests must not touch DOM;
  component logic is verified via the build + manual/browser smoke flow.
- Vitals history (`engine.getHistory()`) is archive-only. Never add it to
  `SimSnapshot` — snapshots broadcast twice a second and history would bloat
  every message (it's why `ArchivedSession.history` is a separate field).
- In NIBP cuff mode (the default), displayed BP and BP alarms come from
  `snapshot.nibp` (last measured), not live values. Only artLine scenarios
  show live pressure. Don't "fix" a stale NIBP tile — the staleness is the
  teaching point.

## Recipes for likely tasks

**Add a scenario:** copy an existing file in `src/scenarios/`, keep ids
lowercase `a-z0-9_-`, ensure every `rubric.actionIds` entry exists in
`expectedActions` and every action `phase` exists in `phases`. Deterioration
events may have `autoAtSec`; treatment-response events must not. Register it
(see trap #1) and run `npm test`. Where new curriculum ships is a
maintainer placement decision (see "Where features belong") — community
contributions are welcome, but for anything beyond fixes to the bundled
set, open an issue before writing content.

**Add a numeric vital:** extend `NumericVitals` + `NUMERIC_VITAL_KEYS`
(types.ts), `VITAL_META` (vitals.ts), the zod partial (schema.ts), every
scenario's `baselineVitals`, `DEFAULT_VITALS`, a `VitalTile` in
`MonitorDisplay`, and `SLIDER_KEYS` in `VitalControls`.

**Add a rhythm:** extend the `Rhythm` union + `RHYTHM_LABELS` (types.ts),
the zod enum (schema.ts), and give it a waveform branch in
`src/components/monitor/waveforms.ts` (add to `PULSELESS` if pulseless —
that's what flattens the pleth and zeroes the pulse display).

**Add a sync transport:** implement `SyncChannel`
(`src/lib/sync/types.ts`) including the `onStatus`/`getHealth` transport-
health methods, register it in `createSyncChannels`. Full-state snapshot
replication is the protocol — do not introduce deltas or ordering
assumptions; transport health is adapter-local metadata, never on the wire.

**Touch cloud sync (`src/lib/cloud/`):** everything there must no-op when
Supabase is unconfigured or the user isn't a signed-in faculty account
(`cloudEligible()`), and the local localStorage write must succeed on its
own first — cloud pushes go through the outbox, never inline. Validate
anything pulled from the cloud with the same zod boundary as file imports.

**Touch scoring:** the policy (done=full, delayed=half, missed/incorrect=0,
critical actions surfaced separately) is documented in `scoring.ts` and
covered by tests. Change tests and `docs/scenario.schema.md` in the same
commit, and call the policy change out loudly in the PR.

## Working style

- Small commits, one concern each; never commit with failing checks.
- Prefer extending existing patterns over inventing new ones — the codebase
  is deliberately uniform (zustand stores, adapter interfaces, zod at the
  boundaries).
- If a requirement seems to force breaking an invariant above, stop and ask
  the maintainer instead of working around it.
