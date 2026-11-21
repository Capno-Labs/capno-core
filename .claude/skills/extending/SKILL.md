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

## Add a machine reading

Ventilator and gas readings are not numeric vitals: they live in the optional
`vent` block (`Ventilation`, `VENT_KEYS`, `VENT_META` in
`src/lib/engine/types.ts`), so existing scenarios stay valid. Extend together:
those three, the default in `defaultVentilation` (`src/lib/engine/vitals.ts`,
with its source), the zod `ventSchema`, a tile in `MonitorDisplay`, the
generator's `SCHEMA_REFERENCE` and `docs/scenario.schema.md`. The controller
and editor fields are generated from `VENT_KEYS`. An alarm on it goes in
`evaluateAlarms` with a limit from a cited machine manual.

## Add a rhythm

Extend together: the `Rhythm` union + `RHYTHM_LABELS`
(`src/lib/engine/types.ts`), the zod enum (`src/lib/engine/schema.ts`), the
hard-coded lists (`RHYTHMS` in `src/components/import/fieldRegistry.ts`, the
`set_rhythm` line of the co-pilot prompt in `src/lib/llm/copilot.ts`, the
generator's `SCHEMA_REFERENCE`, `docs/scenario.schema.md`), and a complex in
`ecgBeat` (`src/components/monitor/waveforms.ts`), timed in milliseconds from
the beat's R wave (`beat.rMs`). If the rhythm can never perfuse, add it to
`NON_PERFUSING_RHYTHMS` in `types.ts` — `hasPulse()` is what flattens the
pleth, blanks SpO₂, stops the pulse tone and fails the cuff; an organized
rhythm without a pulse is the `pulseless` flag, not a new rhythm. Cite the
ECG criteria you drew it from, in the code and in `docs/curriculum.md`. Beat
*timing* (irregular intervals, ectopy patterns, per-beat pulse
strength) lives in `src/components/monitor/beatClock.ts`, which the ECG,
pleth, arterial trace and pulse tone all share; a beat starts with its P
wave, carries its own R-wave time, and may be non-conducted (a P wave with no
QRS, pulse or tone). A rhythm with no discrete beats goes in its
`NON_BEATING` set and draws from `ecgBaseline`. If the new
rhythm has normal-pattern complexes that ST/T/QRS/QT settings should reshape,
add it to `MORPHOLOGY_RHYTHMS` in `types.ts` (that set also decides whether
the monitor prints an ST level) and draw its complex through the
morphology-aware helpers in `ecgBeat`.

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

Review state (`scenarios.status`, `approved_*`) is owned by the database
trigger `scenarios_review_guard` (`db/migrations/0004_scenario_review.sql`):
the head upsert in `scenarioCloud.ts` must never name those columns, and
approval goes through `approveScenario()` only. Per-scenario cloud facts
(version id, review state) live in the sync meta (`outbox.ts`
`SyncMetaEntry`) — add fields there, never a new storage key.

## Touch scoring

The policy (done=full, delayed=half, missed/incorrect=0, critical actions
surfaced separately) is documented in `src/lib/engine/scoring.ts` and
covered by its tests. Change the tests and `docs/scenario.schema.md` in
the same commit, and call the policy change out loudly in the PR.
