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

## Touch the twitch monitor

The neuromuscular block is the optional `nmb` block (`NeuromuscularBlock`,
`NMB_KEYS`, `NMB_META` in `src/lib/engine/types.ts`), mirrored by `nmbSchema`.
The engine keeps the true block and, separately, what the monitor last
measured (`snapshot.tof`, refreshed every `TOF_INTERVAL_SEC` or by
`measureTof()`), the way it keeps true pressure and the last cuff reading.
The tile (`TofTile`) draws only from `snapshot.tof`; bar heights come from
`twitchHeights` in `readouts.ts`. The depth names (`blockDepth`) follow the
ASA table and are faculty-only. A new field moves with: those three, the zod
schema, `tofReading`, the tile, the controller block, `NmbFields`, the
generator's `SCHEMA_REFERENCE` and `docs/scenario.schema.md`.

## Touch alarm limits

Limits live in `ALARM_PROFILES` (`src/lib/engine/vitals.ts`), one set per
patient category, with the manual each value came from. A scenario picks a
category (`monitoring.alarmProfile`) and may change single limits
(`monitoring.alarmLimits`); `resolveAlarmLimits` combines them and
`alarmLimitProblems` is what the schema rejects on. The engine sends the
limits in force in `snapshot.alarmLimits` — the tiles print them and the
debrief's turning points re-read history against them. A new vital with
limits joins `ALARM_VITALS` (types), every profile, `alarmLimitsSchema`, the
generator's `SCHEMA_REFERENCE` and the table in `docs/scenario.schema.md`.
Change a profile's numbers only with a source.

The machine's alarms (`paw`, `mv`, `fio2` — `MACHINE_ALARM_PARAMS`) share
the same limits object, with one limit a side in the band of the alarm's
priority. `ALARM_PARAMS` is everything with limits; `ALARM_PARAM_META` has
each one's label and range, and `ALARM_SET_KEYS` says which band key each
side sets (a vital's warning limit; a machine reading's only limit). Use
those three, not `VITAL_META` and `warnLow`/`warnHigh`, in anything that
handles limits generally. Minute-volume alarms still carry
`AlarmState.vital: 'vt'` — the tile they light.

At runtime the monitor is operated through `AlarmSetup`
(`src/components/monitor/`), opened by selecting a tile: it calls
`setAlarmLimit` / `setAlarmOff` (engine → `withAlarmLimit`, the `alarmsOff`
set). `MonitorDisplay` is operable where it is given `alarmSetup` actions:
the faculty preview passes the store's, and a student display passes ones
that send a `monitor` request (`src/lib/sync/monitorRequest.ts`) while
`snapshot.learnerAlarmSetup` is true. The controller validates each request,
counts it once (`createRequestGate` — a display can reach it on two
transports) and applies it with `by: 'display'`, which marks the log line.
The request vocabulary is deliberately three kinds (limit step, alarms
on/off, Silence); a test pins it, and invariant 3 says who decides on more.

Silence is `acknowledgeAlarms()`: it remembers which alarms were active
(`alarmKey` — vital, priority and kind, not the number) and marks them
`acknowledged` in the snapshot until their cause clears. Sound
(`alarmTier`), the banner and the tiles all read that mark; the faculty
"pause all alarms" toggle (`alarmsSilenced`) is a separate, global switch.

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

The score is computed and stored (`ArchivedSession.score`: the JSON export,
the cloud `sessions.score` column, the hosted layer's cohort analytics) but
**not shown anywhere in the studio** — the debrief walkthrough and the
session record report marks, not points. Don't add a score back to the
debrief UI, and don't stop storing it: both are maintainer decisions.
