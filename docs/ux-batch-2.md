# UX batch 2 — demo tour, debrief narrative, note editing (spec)

> **Status: implemented.** All three pieces below shipped (decision record,
> debrief upgrades, guided demo tour) and were verified end-to-end in the
> browser: the tour walks all eight steps against the live cockpit, the
> two-tab sync smoke passes, and post-hoc notes persist across reloads.
> This batch closes out the remaining items of
> `docs/ux-ui-improvement-spec.md` (priorities 5–7) and the loop with the
> hosted layer's launch spec, whose non-goals section explicitly leaves
> "capno-core's own UX roadmap (script-rail, debrief narrative, demo tour)"
> to this repo. Status ticks below are updated as commits land.

## Scope

Three pieces, in implementation order:

1. **Decision record:** script-rail event delay/skip is **superseded** — no
   engine changes (below).
2. **Debrief upgrades** (spec items 6-debrief-half + 7): narrative
   reorganization of the report, a new derived **Key clinical turning
   points** section, and post-hoc faculty note editing.
3. **Guided demo tour** (spec item 9): hand-rolled coach marks over the
   current Flow-panel cockpit, entered via `?demo=1`.

Out of scope, unchanged from the reviewed spec: score adjustments (needs
maintainer sign-off), the event→expectedAction *scoring* link (schema
cascade; `linkedActionIds` remains display-only), the visual identity pass
(shipped separately with the brand work), and any cross-page tour.

## Decision record — vitals presets removed pre-launch

The vitals presets (Recovery/Normalize, Hypotension, Desaturation,
Bronchospasm) shipped with target values flagged "pending faculty review"
— clinical content under invariant 7 that never received sign-off. The
maintainer chose to remove the feature rather than launch with unreviewed
clinical values or hold the release on a review. Sliders + ramps, rhythm
and CO₂ waveform controls, and scenario events cover the same need; the
engine's generic `applyNamedEffect` primitive stays (tested in
`engine.test.ts`) as the extension point a reviewed preset pack could use
later. If presets return, they return with faculty-reviewed values.

## Decision record — event delay/skip (spec item 5) is superseded

The original item 5 called for `delayEvent(id, sec)` and a
`skippedEventIds` snapshot field. Since it was written, the controller was
reworked for timed lab days (see the historical note in
`docs/ux-ui-improvement-spec.md`):

- **Auto events are manual-by-default** behind a toggle
  (`autoEventsEnabled`, engine + store). With no countdown running there is
  nothing to *delay* in the default mode; the instructor is the pacemaker.
- **"Skip" is the default state of every event.** An unfired card simply
  never fires; it does not clutter the Flow panel's next-up logic because
  `pinNextEvent` lets the instructor redirect pacing to any card without
  rescheduling anything.
- **Improvisation is covered** by ad-hoc events (`engine.addEvent`, PR
  #10), which the old delay/skip design never addressed.

Verdict: the two engine/schema changes are no longer justified by any
remaining workflow gap. The "preview effects" half of item 5 shipped with
the Flow panel (events render their linked effects). If a future timed-mode
gap reappears, reopen against the Flow panel, not the retired script rail.

## Debrief: narrative reorganization + turning points

### Section order (DebriefReport)

Header → **Outcome summary** (score + category bars — the headline number
of a printable artifact stays near the top; deliberate deviation from the
spec's ordering, which buried it) → **What happened** (vitals trend strip +
timeline) → **Key clinical turning points** (new) → **What the learner
did** (actions by status) → **Missed or delayed critical actions**
(promoted) → **Faculty notes** → Debrief guide → Reference. Print CSS
untouched except pagination guards if needed.

### Turning-point derivation (new module `src/lib/debrief/turningPoints.ts`)

Pure functions over data already in the archive — no schema change, no
generated clinical text (labels are engine log text and vital names only).

```ts
interface TurningPoint {
  t: number;
  kind: 'event' | 'phase' | 'rhythm' | 'alarm' | 'recovery';
  severity: 'info' | 'warning' | 'critical';
  label: string;
  detail?: string;
}
deriveTurningPoints(
  session: Pick<ArchivedSession, 'snapshot' | 'history' | 'scenario'>
): TurningPoint[]
```

Heuristics, all test-pinned:

- **Events:** log entries with `kind === 'event'` → one point each;
  severity `info` when the matching scenario event's `category` is
  `'resolution'`, else `warning`. Matching is by label against the archived
  scenario (`getEffectiveScenario()` is what's archived, so ad-hoc events
  resolve too); unmatched labels default to `warning`.
- **Phases:** log `kind === 'phase'` → `info`.
- **Rhythm changes:** `vital_change` log labels beginning `"Rhythm → "`,
  reverse-mapped through `RHYTHM_LABELS`; `critical` for the lethal set
  (vtach/vfib/pea/asystole), else `warning`.
- **Alarm crossings:** the engine declares an `'alarm'` log kind but never
  writes it, so alarm points are *derived*: run `evaluateAlarms` over each
  `history` sample (10 s cadence) padded with `DEFAULT_VITALS` (which pins
  rhythm to sinus, so rhythm alarms can't double-fire here). Emit a point
  only on per-vital level **escalation** (none→warning, →critical), with a
  30 s per-vital coalescing window.
- **BP respects the monitoring mode** (the stale-NIBP teaching point): in
  cuff mode BP points come from parsed `"NIBP s/d"` log lines, not live
  history samples; live-history BP is used only for art-line scenarios.
- **Recovery:** after any excursion, the first sample where a vital returns
  inside warning limits → one `info` point per excursion.

Tolerates `history === undefined` (quota-stripped archives) — event, phase,
rhythm, and NIBP points still derive from the log. Rate-of-change ramp
detection is deferred: escalation crossings already catch displayed
deteriorations, and slope thresholds would be clinical content.

Known fragility, accepted and test-pinned: rhythm and NIBP parsing read
engine log label text (`"Rhythm → …"`, `"NIBP s/d"`). Structured log detail
would be an engine change — out of scope for a presentation feature.

### Post-hoc faculty note editing

- `FacultyNote` gains optional `postHoc?: boolean` (types.ts). Additive,
  optional, JSON-serializable — matches how `sessionCode`, `history`,
  `learnerNames`, and `autoEventsEnabled` joined `capno:sessions:v1`, so
  **no key version bump**. The types/schema move-together invariant covers
  the `Scenario` authoring schema; session exports validate snapshots with
  `.passthrough()` and tolerate the new field.
- The amend surface grows `setNotes(notes: FacultyNote[])` alongside the
  existing `markAction`/`setLearners`, persisted through the same
  `updateSession()` + cloud repush path.
- UI (amend mode only, `no-print`): edit/delete existing notes, "Add note"
  appends `{ t: snapshot.elapsedSec, postHoc: true }`; post-hoc notes render
  with an "added at debrief" chip so the record stays honest. The computed
  score is untouched.

## Guided demo tour

- **Entry:** homepage CTA → `/faculty/run/laryngospasm-lma?demo=1`. The run
  page consumes `demo` with the same StrictMode-safe one-shot URL-param
  pattern as `?code=` (single `URLSearchParams` read strips both). The tour
  renders inside `FacultyGate` children — the PIN, when configured, always
  comes first.
- **Scenario:** `laryngospasm-lma`, per the reviewed spec — the bundled
  demo case with a clean arc; autos are off by default so the tour, not a
  timer, paces the walkthrough.
- **Steps (8),** anchored to the current cockpit via `data-tour`
  attributes: welcome (centered) → connect the student display
  (PreStartPanel; the user opens a real `/student` tab — no fake student,
  invariant 3) → start → the Flow panel (next-up card, N hotkey, pin) →
  vitals (sliders, ramps) → mark a learner action → end session →
  what the debrief shows (centered; Finish persists "seen"). The tour never
  crosses routes.
- **Mechanics:** hand-rolled, no dependency (invariant 6).
  `querySelector` + `scrollIntoView` + `getBoundingClientRect`; fixed
  coach-mark card with flip positioning and an rAF-throttled reposition on
  scroll/resize; highlight ring is `pointer-events-none`; the page stays
  interactive (no backdrop). Below the `sm` breakpoint the card becomes a
  bottom sheet; a missing anchor falls back to a centered card so anchor
  drift can't strand the tour.
- **Keyboard:** Esc closes (and persists "seen"); Enter/arrows navigate
  only while the card owns focus, so the cockpit's Space/N shortcuts keep
  working.
- **Storage:** `capno:demo:v1` = `{ "seenAtIso": string }`, helpers in
  `src/lib/demoTour.ts` that no-op without `window`. When the flag is
  present and the tour was already seen, the command bar offers a
  "Restart tour" button instead of silently doing nothing.
- **Copy is UI guidance only** — clinical narration stays in the scenario's
  own reviewed text (invariant 7).

## Test plan

- New Node-env Vitest: `src/lib/debrief/turningPoints.test.ts` (event
  severity by category, phase, rhythm parsing incl. lethal set, alarm
  escalation + coalescing, cuff-vs-artline BP sourcing, recovery, missing
  history), `src/lib/demoTour.test.ts` (step integrity, selector shape,
  storage no-op without `window`), plus a notes-patch round-trip in the
  session archive tests.
- Existing constraints respected: scoring tests (notes never affect score),
  exact bundled-scenario count, snapshot JSON round-trip, export
  passthrough.
- Manual, per CLAUDE.md: two-tab sync smoke for the controller-touching
  commits; full tour walkthrough (PIN configured and not, seen-key reentry,
  phone/tablet widths); a debrief containing a rhythm change and an SpO₂
  excursion to eyeball turning points; note edit → reload → persists; print
  preview of the reorganized report.
