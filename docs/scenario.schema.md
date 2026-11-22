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
| `monitoring` | object? | What the monitor is connected to. Absent = NIBP cuff cycling every 180 s, ECG lead II only. `{ "artLine": true }` = continuous arterial pressure. `{ "nibpIntervalSec": 120 }` overrides the cuff interval (15–1800 s). `{ "v5": true }` adds a V5 ECG trace under lead II, with its own ST level. In cuff mode the monitor and BP alarms use the last *measured* reading; faculty can cycle the cuff, place a line, or add the V5 lead during a session. `alarmProfile`, `alarmLimits` and `alarmsOff` set the alarm limits and which alarms start switched off — see [Alarm limits](#alarm-limits). |

## `patient`

Demographics (`name`, `age`, `sex`, `weightKg`, `heightCm`, `asa` 1–6), plus
`allergies`, `medications`, `pmh` (string arrays), an `airway` exam
(`mallampati` 1–4 and optional `mouthOpeningCm`, `thyromentalCm`,
`neckMobility`, `dentition`, `notes`) and an optional free-text `plan`.

**Learners may see this block.** Faculty can turn on a pre-brief that shows
the whole `patient` object on student displays until the scenario starts (off
by default). Write it as the pre-operative record a learner would be handed:
facilitator notes and anything that gives the case away belong in `setup` or
the events, not here. Nothing else in the scenario — title, summary,
objectives, events — is ever sent to a student display.

## `baselineVitals`

All fields required: `hr`, `sbp`, `dbp`, `spo2`, `etco2`, `rr`, `temp` (°C),
`depth` (0–100 processed-EEG-style index), `agentEt`, `agentFi` (volatile %),
and `rhythm` (one of `sinus`, `sinus_brady`, `sinus_tach`, `pvc`, `pac`,
`afib`, `svt`, `vtach`, `vfib`, `pea`, `asystole`, `av_block_1`,
`av_block_mobitz1`, `av_block_mobitz2`, `av_block_3`, `junctional`,
`aflutter`, `torsades`, `paced`, `idioventricular`).

Optional: `pulseless` (boolean) — no pulse despite an organized rhythm.
Pulseless electrical activity is any organized rhythm with
`"pulseless": true` (a sinus tachycardia with no pulse, for example); pulseless
VT is `vtach` with it. The pleth and arterial trace go flat, SpO₂ loses its
reading, the pulse tone stops and the cuff fails; the ECG and the heart-rate
number carry on, and the only alarm is the oximeter's "no pulse". `vfib`,
`torsades`, `asystole` and the older wide-complex `pea` rhythm never have a
pulse, whatever this says. It does not change the pressures: set those in the
same effect.

Keep a pulse pressure of at least 20 mmHg (`dbp` ≤ `sbp` − 20) here and in
every event effect: validation rejects a `baselineVitals` block or an effect
that sets both values closer than that, and the engine clamps `dbp` down to
`sbp` − 20 at runtime (including effects that move only one of the pair).
The floor is 0, so arrest states (`sbp: 0, dbp: 0`) remain valid.

Optional: `capnoShape` — capnograph trace morphology: `normal` (default),
`bronchospasm` (the slurred, upsloping "shark fin" of obstructed expiration),
`curare_cleft` (a normal plateau with a transient notch — spontaneous
respiratory effort during partial neuromuscular blockade), `cardiogenic`
(ripples in time with the heartbeat as a long expiration tails off), or
`leak` (the trace peaks early and sags — a cuff or circuit leak). These are
display-only; the EtCO2 number is unaffected.

`esophageal` is the exception: the tube is in the esophagus, so the *measured*
EtCO2 starts at no more than 7 mmHg, shrinks with each breath and reads zero
from the seventh breath on, whatever `etco2` is set to — the number, the
trace and the low-CO2 alarm all follow. Set the shape back to `normal` and
the monitor reads the authored value again.

Optional: `agent` — the volatile agent `agentEt`/`agentFi` refer to:
`sevoflurane` (default), `isoflurane` or `desflurane`. The monitor labels the
tile SEV, ISO or DES and shows the end-tidal value as a multiple of the
patient's age-adjusted MAC, computed from `patient.age`.

Optional: `vent` — anesthesia-machine readings. Its presence, even as `{}`,
puts three more tiles on the monitor from the start; leave it out for a case
with no ventilator (faculty can still add the tiles during a session).

| Field | Range | Meaning |
| --- | --- | --- |
| `fio2` | 0–100 % | Inspired oxygen. |
| `pip` | 0–80 cmH₂O | Peak inspiratory pressure. |
| `pplat` | 0–60 cmH₂O | Plateau pressure. |
| `peep` | 0–25 cmH₂O | Positive end-expiratory pressure. |
| `vt` | 0–1500 mL | Exhaled tidal volume. Minute volume is shown from it and `rr`. |

Fields left out take the defaults for the patient: tidal volume 7 mL/kg of
*predicted* body weight (from `patient.heightCm` and `sex`), PEEP 5, peak 18,
plateau 16, FiO₂ 50. These are readings, not a lung model: nothing else moves
when they change, so an effect that raises peak pressure for bronchospasm
should also set the SpO₂, EtCO₂ and capnogram shape that go with it. The
monitor shows the plateau no higher than the peak and PEEP no higher than the
plateau. Alarms: airway pressure above 40 or below 8 cmH₂O, minute volume
under 3 or over 12 L/min, inspired oxygen under 20% — the starting limits,
which a scenario or the monitor's alarm setup can change (see
[Alarm limits](#alarm-limits)).

Optional: `nmb` — the neuromuscular block, as a twitch monitor finds it. Its
presence, even as `{}`, attaches a twitch monitor from the start (faculty can
also attach one during a session): a TOF tile with the reading and four bars
for the twitches of the last train.

| Field | Range | Meaning |
|---|---|---|
| `tofCount` | 0–4, whole | Train-of-four count: twitches present after four stimuli. |
| `tofRatio` | 0–100 % | Fourth twitch as a percentage of the first. Read only while the count is 4. |
| `ptc` | 0–15, whole | Post-tetanic count. Read only while the count is 0. |

Fields left out mean no block (count 4, ratio 100%). A count under 4 takes
the ratio to 0 unless you state one, so a later recovery climbs from 0. The
tile shows the ratio when all four twitches are present and the count alone
when fewer are, with the post-tetanic count beneath at a count of 0. Like the
cuff, the twitch monitor shows its last measurement: it stimulates every
15 seconds (or when faculty press **Stimulate now**), so a change appears at
the next measurement, not at once. There are no alarms on it. It is a
reading, not a drug model: a reversal event states the count and ratio it
produces and how fast (`overSec`).

Optional: `fico2` — inspired CO2 in mmHg (0–30), the level the trace returns
to between breaths. Normally 0; above zero is rebreathing (exhausted
absorbent, a stuck valve) and the baseline rises to it. Shown beside the
respiratory rate as "Fi", with a warning alarm above 4 mmHg. In an effect it
ramps over `overSec`. It does not change `etco2` — and in reported cases of
rebreathing EtCO2 rose as well, so raise that in the same effect.

Optional: `pvcFrequency` — how often an ectopic complex replaces a sinus
beat while the rhythm is `pvc`: `rare` (1:8), `occasional` (1:4, default),
`trigeminy` (1:3), or `bigeminy` (1:2). Display-only; ignored for other
rhythms.

Optional: `ecg` — how each complex is drawn in lead II, independent of the
rhythm. Omit it (or any field) for a normal ECG.

| Field | Values | Meaning |
| --- | --- | --- |
| `stMm` | −5 to 5 | ST-segment level in lead II, in millimetres at standard gain (1 mm = 0.1 mV). Negative = depression, positive = elevation. Shown on the monitor as "ST II". |
| `stV5Mm` | −5 to 5 | The same for lead V5, independent of lead II. Drawn, and shown as "ST V5", only when the monitor has a V5 lead (`monitoring.v5`, or added by faculty). |
| `tWave` | `normal`, `peaked`, `flat`, `inverted` | T-wave shape. |
| `qrs` | `normal`, `wide` | QRS width. |
| `qt` | `normal`, `long` | QT interval. |

Display-only — HR, pressures and alarms are unaffected. It reshapes beats
with a normal conduction pattern (the sinus rhythms, AF, SVT, PACs and the
normal beats between PVCs); PVCs themselves, VT, VF, PEA and asystole are
drawn as before, and the monitor shows "ST II --" for the last four.

## `phases`

Ordered list of `{ id, label, description?, targetDurationSec? }` — phases
of care (e.g. preinduction → induction → maintenance…). The faculty
controller steps through them; expected actions group by phase. The
optional `targetDurationSec` is a pacing budget for that phase: the phase
stepper shows elapsed-in-phase against it and flags overruns (display
only, no engine behavior).

## Alarm limits

The monitor alarms when a vital crosses a limit: a **warning** below `warnLow`
or above `warnHigh`, **critical** below `critLow` or above `critHigh`. The
limits come from the monitor's patient category, `monitoring.alarmProfile`:

| Vital | `adult` (default) | `pediatric` | `neonatal` |
|---|---|---|---|
| `hr` warning / critical | 50–110 / 40, 140 | 75–160 / 55, 180 | 100–200 / 80, 220 |
| `sbp` warning / critical | 90–160 / 70, 200 | 70–120 / 60, 130 | 40–90 / 35, 95 |
| `spo2` low warning / critical | 92 / 85 | 92 / 85 | 85 / 80 |
| `rr` warning / critical | 8–24 / 4, 35 | 8–30 / 4, 35 | 30–100 / 4, none |
| `etco2` warning / critical | 25–50 / 15, 60 | same | same |
| `temp` warning / critical high | 35–38 / 39.5 | same | same |
| `paw` critical (airway pressure, cmH₂O) | 8, 40 | same | same |
| `mv` warning (minute volume, L/min) | 3–12 | same | same |
| `fio2` critical low (inspired oxygen, %) | 20 | same | same |

The last three are the anesthesia machine's alarms. They apply only while
the machine readings are on the monitor, and each has one limit a side, in
the band of its priority: `paw` uses `critLow` (the apnea-pressure
threshold) and `critHigh`, `mv` uses `warnLow` and `warnHigh`, and `fio2`
uses `critLow` only. Their starting values are the machine's defaults in
every category, so a small child's minute volume sits under 3 L/min until a
scenario lowers `mv.warnLow`.

Blood-pressure limits are systolic, and in cuff mode they are read against
the last cuff measurement. The category is the author's choice, as it is the
user's on a real monitor: it does not follow `patient.age` (the editor notes
a patient under 18 left on the adult limits). Faculty can switch category
during a session.

`monitoring.alarmLimits` changes single limits for one case. Only the limits
listed change; `null` switches one off:

```jsonc
"monitoring": {
  "alarmProfile": "pediatric",
  "alarmLimits": {
    "hr": { "warnHigh": 170 },      // this child runs fast: warn above 170, not 160
    "temp": { "warnLow": null }     // no low-temperature warning in this case
  }
}
```

`monitoring.alarmsOff` lists vitals whose limit alarms start switched off —
`"alarmsOff": ["spo2"]` for the monitor someone left with the saturation
alarm disabled. The monitor shows an alarms-off mark (🔕) beside that number
in place of its limits. Only limit alarms are switched off: the oximeter's
lost-signal alarm and the rhythm alarms still sound.

During a session the low and high limit of each vital and machine reading
are set, and its alarms switched on or off, by selecting the number on the
monitor — by faculty on the preview, and by learners on their display while
faculty allow it; a reset returns to what the scenario states.

Each limit must lie in the vital's range, and the result must stay
consistent — a critical limit at or beyond its warning limit, low limits
below high ones — or validation rejects the scenario. The monitor prints the
limits beside each number. The inspired-CO₂ alarm and the rhythm alarms are
fixed.

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
    { "fico2": 8, "overSec": 300 },                           // rebreathing: the baseline creeps up
    { "vent": { "pip": 42 }, "overSec": 60 },                 // peak airway pressure climbing; plateau unchanged
    { "nmb": { "tofCount": 4, "tofRatio": 90 }, "overSec": 120 }, // block reversing: four twitches, ratio climbing to 90%
    { "ecg": { "stMm": -1, "stV5Mm": -2 }, "overSec": 60 },   // ST depression developing over 60 s, deeper in V5
    { "ecg": { "tWave": "peaked", "qrs": "wide" } },          // other ECG changes switch instantly
    { "rhythm": "sinus_tach", "pulseless": true },            // PEA: the rhythm stays, the pulse goes
    { "vitals": { "spo2": 88 }, "overSec": 90, "afterSec": 60 } // starts 60 s later
  ]
}
```

Effects ramp numeric vitals linearly to the target over `overSec` seconds
(0/omitted = instant); the ST levels in `ecg`, `fico2` and every reading in
`vent` and `nmb` ramp the same way (a ramping count passes through the whole
numbers between). An
`ecg` effect changes only the fields it lists — to return to normal, set
them explicitly (`"stMm": 0`, `"tWave": "normal"`). `afterSec` delays the
effect after the trigger.
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
