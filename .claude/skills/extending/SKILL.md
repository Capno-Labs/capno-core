---
name: extending
description: Recipes for extending Capno — add a scenario, numeric vital, rhythm, or sync transport; change cloud sync or scoring. Use whenever a task adds one of these or touches src/lib/cloud/ or scoring.ts.
---

# Extending Capno

Each recipe lists every file that must move together. The invariants in
`CLAUDE.md` still apply — especially #2 (types/schema mirroring) and #7
(clinical content must be source-verified).

## Add a scenario

Copy an existing file in `src/scenarios/` — the bundled scenarios are the
structural reference. Ids are lowercase `a-z0-9_-`. Every
`rubric.actionIds` entry must exist in `expectedActions`, and every action
`phase` must exist in `phases`. Deterioration events may have `autoAtSec`;
treatment-response events must not. Then register it: static import in
`src/lib/scenarios/registry.ts`, and update the exact count + id list in
`src/lib/engine/schema.test.ts`. `npm test` validates every scenario file
against the zod schema and the scenario lint rules (`lint.test.ts`).

Where new curriculum ships is a maintainer placement decision (see
CLAUDE.md "Where features belong") — for anything beyond fixes to the
bundled set, open an issue before writing content, and cite clinical
sources in `docs/curriculum.md`.

## Add a numeric vital

Extend together: `NumericVitals` + `NUMERIC_VITAL_KEYS`
(`src/lib/engine/types.ts`), `VITAL_META` (`src/lib/engine/vitals.ts`),
the zod partial (`src/lib/engine/schema.ts`), every scenario's
`baselineVitals`, `DEFAULT_VITALS`, a `VitalTile` in `MonitorDisplay`, and
`SLIDER_KEYS` in `VitalControls`.

## Add a rhythm

Extend together: the `Rhythm` union + `RHYTHM_LABELS`
(`src/lib/engine/types.ts`), the zod enum (`src/lib/engine/schema.ts`),
and a waveform branch in `src/components/monitor/waveforms.ts`. If the
rhythm is pulseless, add it to `PULSELESS` there — that set is what
flattens the pleth and zeroes the pulse display.

## Add a sync transport

Implement `SyncChannel` (`src/lib/sync/types.ts`), including the
`onStatus`/`getHealth` transport-health methods, and register it in
`createSyncChannels`. Full-state snapshot replication is the protocol —
no deltas, no ordering assumptions. Transport health is adapter-local
metadata, never on the wire.

## Touch cloud sync (`src/lib/cloud/`)

Everything there must no-op unless `cloudEligible()` (Supabase configured
and a signed-in faculty account), and the local localStorage write must
succeed on its own first — cloud pushes go through the outbox, never
inline. Validate anything pulled from the cloud with the same zod boundary
as file imports.

## Touch scoring

The policy (done=full, delayed=half, missed/incorrect=0, critical actions
surfaced separately) is documented in `src/lib/engine/scoring.ts` and
covered by its tests. Change the tests and `docs/scenario.schema.md` in
the same commit, and call the policy change out loudly in the PR.
