# Scenario file reference

A Capno scenario is a single JSON document validated by the zod schema in
`src/lib/engine/schema.ts` (the runtime source of truth). Export any built-in
scenario from the library for a complete working example.

## Top level

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable, lowercase, `a-z0-9_-`. Custom scenarios with a built-in id shadow the built-in. |
| `version` | string | Free-form (semver recommended). Shown in version history. |
| `title`, `summary` | string | Library card text. |
| `tags.topics` | string[] | Free-form topic tags (≥1). Used for library filtering. Convention: `topics[0]` is one curriculum domain from the closed vocabulary in [curriculum.md](curriculum.md); the rest are free-form specifics. |
| `tags.difficulty` | enum | `beginner` \| `intermediate` \| `advanced` |
| `tags.trainingLevels` | enum[] | `medical_student`, `srna`, `saa`, `resident_junior`, `resident_senior`, `crna`, `caa`, `attending` |
| `learningObjectives` | string[] | ≥1. Shown in library details and debrief. |
| `setup` | string[] | Room/equipment/confederate instructions for faculty. |
| `estimatedMinutes` | number | Library display only. |
| `targetDurationSec` | number? | Optional hard time budget for a scheduled lab slot. The run screen counts down against it and flags overruns; pacing display only, never drives engine behavior. |
| `monitoring` | object? | BP display mode. Absent = NIBP cuff cycling every 180 s. `{ "artLine": true }` = continuous arterial pressure. `{ "nibpIntervalSec": 120 }` overrides the cuff interval (15–1800 s). In cuff mode the monitor and BP alarms use the last *measured* reading; faculty can cycle the cuff on demand. |

## `patient`

Demographics (`name`, `age`, `sex`, `weightKg`, `heightCm`, `asa` 1–6), plus
`allergies`, `medications`, `pmh` (string arrays), an `airway` exam
(`mallampati` 1–4 and optional `mouthOpeningCm`, `thyromentalCm`,
`neckMobility`, `dentition`, `notes`) and an optional free-text `plan`.

## `baselineVitals`

All fields required: `hr`, `sbp`, `dbp`, `spo2`, `etco2`, `rr`, `temp` (°C),
`depth` (0–100 processed-EEG-style index), `agentEt`, `agentFi` (volatile %),
and `rhythm` (one of `sinus`, `sinus_brady`, `sinus_tach`, `pvc`, `pac`,
`afib`, `svt`, `vtach`, `vfib`, `pea`, `asystole`).

Keep `dbp` below `sbp` here and in every event effect: the engine enforces
diastolic ≤ systolic at runtime and will silently clamp a `dbp` at or above
`sbp` down to the systolic value.

Optional: `capnoShape` — capnograph trace morphology, `normal` (default) or
`bronchospasm` (the slurred, upsloping "shark fin" of obstructed expiration).
Display-only; the EtCO2 number is unaffected.

## `phases`

Ordered list of `{ id, label, description?, targetDurationSec? }` — phases
of care (e.g. preinduction → induction → maintenance…). The faculty
controller steps through them; expected actions group by phase. The
optional `targetDurationSec` is a pacing budget for that phase: the phase
stepper shows elapsed-in-phase against it and flags overruns (display
only, no engine behavior).

## `events`

Faculty-triggerable (or automatic) occurrences:

```jsonc
{
  "id": "full-anaphylaxis",
  "label": "Full anaphylaxis",
  "description": "Profound vasoplegia and bronchospasm",
  "category": "circulation",     // physiology | airway | circulation | drug |
                                 // equipment | surgical | resolution | other
  "autoAtSec": 300,              // optional: fires itself at elapsed t (else faculty-only)
  "actionIds": ["give-epinephrine-early"],  // optional: linked expectedActions ids
  "effects": [
    { "vitals": { "sbp": 55, "dbp": 30 }, "overSec": 120 },  // ramp over 120 s
    { "rhythm": "sinus_tach" },                               // rhythm switches instantly
    { "capnoShape": "bronchospasm" },                         // CO2 trace morphology, instant
    { "vitals": { "spo2": 88 }, "overSec": 90, "afterSec": 60 } // starts 60 s later
  ]
}
```

Effects ramp numeric vitals linearly to the target over `overSec` seconds
(0/omitted = instant). `afterSec` delays the effect after the trigger.
Faculty can always override any vital manually afterward — manual changes and
events use the same ramp mechanism, last write wins per vital.

### Authoring conventions and editor warnings

- **Automatic vs faculty-fired.** An event with `autoAtSec` fires itself at
  that elapsed time (scripted deterioration); an event without it only fires
  when faculty tap it (treatment responses, improvised turns). Deterioration
  events may have `autoAtSec`; treatment-response events must not. Faculty
  can always fire an automatic event early, which cancels its timer.
- **`phaseHint` is a display hint, not a reference.** It is shown verbatim
  on the faculty run screen and is not validated against `phases` (the
  editor offers a dropdown of phase ids but tolerates free text).
- **`actionIds` links an event to the learner actions it embodies or
  responds to** (e.g. an epinephrine-response event links the "give
  epinephrine" action), so the run screen can show those actions next to
  the event's fire button. Every entry must be an existing
  `expectedActions` id — this *is* validated. Linking is display/grouping
  only: firing an event never marks an action, and marking an action never
  fires an event. Actions linked by no event appear in the run screen's
  general checklist.
- **Write events in narrative order.** The run screen sorts automatic events
  by time, but the file reads best when the story reads top to bottom.

The editor also runs non-blocking lint checks (`lintScenario` in
`src/lib/engine/lint.ts`) and shows the results as authoring warnings —
saving is never blocked:

| Severity | Check |
| --- | --- |
| warning | `phaseHint` matches no phase id |
| warning | `autoAtSec` is later than `estimatedMinutes` × 60 |
| info | event has no effects (log-only marker — often intentional) |
| info | `autoAtSec` is 0 (fires the instant the scenario starts) |
| info | automatic events listed out of time order |

## `expectedActions`

`{ id, label, description?, phase?, critical, points }` — the checklist the
faculty marks during the run. `critical: true` actions are highlighted, and
any critical action not marked **done** appears in the debrief's
"Critical actions not completed" list. Scoring: done = full points,
delayed = half, missed/incorrect = 0.

## `rubric`

Categories `{ id, label, actionIds[] }` grouping actions for the score
breakdown (e.g. recognition / management / communication). Every `actionId`
must exist; uncategorized actions still count in an "Other actions" bucket.

## Teaching content

`expectedProgression`, `correctManagement`, `commonErrors` (string arrays)
and `debrief: { points[], questions[] }` all render in the debrief report.
