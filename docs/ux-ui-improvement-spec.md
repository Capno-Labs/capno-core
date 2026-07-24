> **Historical spec — implemented.** Kept as a decision record; not current
> guidance. Component names may be stale; see `docs/faculty-guide.md`.

# CAPNO Studio — UX/UI improvement spec (reviewed)

> **Historical note (2026-07).** The controller has since been reworked for
> timed lab days: the script rail, event grid, and action checklist described
> below were merged into a single **Flow panel** (events in narrative order
> with their linked learner actions), auto events became manual-by-default
> behind a toggle, and pacing aids (slot budget, phase targets, N hotkey,
> "Run next student" turnover) were added. Component names in this spec may
> no longer exist; see `docs/faculty-guide.md` for current behavior.

> **Status of this document.** This is the reviewed and edited version of the
> original UX/UI improvement spec. It was checked line-by-line against the
> codebase as of `main` (post PR #10). Edits fall into three groups:
>
> 1. **Already built.** Several proposals exist today (the script rail, the
>    two-column cockpit, debrief amendment, vitals ramps, per-case debrief
>    questions). Those sections are rewritten as *enhancements to existing
>    components*, not greenfield work.
> 2. **Invariant conflicts.** A few proposals collide with the working
>    contract in `CLAUDE.md` (auto-generated clinical content, implied PDF
>    libraries, module naming). Those are amended so they can be implemented
>    without breaking the contract.
> 3. **Hidden costs surfaced.** Items that silently require engine/schema
>    changes (event rescheduling, event→action links, score adjustments) now
>    say so, because schema changes cascade to `types.ts`, `schema.ts`,
>    `docs/scenario.schema.md`, all five bundled scenarios, and the editor.

## Goal

Improve CAPNO Studio's UX/UI so it feels like a polished anesthesia
simulation cockpit for busy faculty instructors, while keeping the current
core architecture and features intact.

The main user workflow is:

**Pick case → connect student display → run simulation → score learner
actions → generate debrief.**

Optimize for low cognitive load during live sim sessions.

## Constraints that shape every item below

These come from `CLAUDE.md` and are non-negotiable for this work:

- **Offline-first.** No feature may require network by default. The wizard,
  demo, and debrief must all work with Supabase unconfigured.
- **No new heavy dependencies.** No tour/onboarding libraries, no chart
  libraries, no jsPDF. Guided flows are hand-rolled; PDF export stays
  print CSS.
- **Clinical content is reviewed material.** Any demo narration or debrief
  prompts containing physiology numbers or treatment sequences must be drawn
  from the reviewed scenarios and flagged for faculty review in the PR —
  never invented.
- **The controller is the single authority.** Nothing here adds
  student→faculty messages or a second tick loop.
- **Naming.** The platform is **CAPNO Studio** — the only branded name.
  Everything inside it uses plain descriptive names (case library, case
  editor, student monitor, debrief); the old module brand names are
  retired. Routes, storage keys, and channel names stay unchanged.

---

## 1. Redesign home page around workflow

**Current state:** `src/app/page.tsx` renders four equal-weight module
cards (branded name first, emoji icon, description). Nothing tells a new
user where to start.

Replace the equal-weight cards with a workflow-oriented landing page.

Primary actions, plain-language labels:

| Action label      | Route        |
| ----------------- | ------------ |
| Run a Case        | `/scenarios` |
| Join as Student Display | `/student`   |
| Review Debriefs   | `/debrief`   |
| Build a Case      | `/editor`    |

Visual weight should follow frequency of use: **Run a Case** is the primary
CTA for faculty; **Join as Student Display** is the primary CTA on the
device at the head of the bed. The two review/authoring actions are
secondary.

The homepage must immediately communicate what the user can do and where to
start, and must keep the "For simulation and education only — not for
clinical use" footer (invariant 8).

## 2. Add faculty session setup wizard (pre-run panel)

**Current state:** `/scenarios` already shows title, difficulty, topics,
estimated duration, and expandable learning objectives/setup per case.
`/faculty/run/[scenarioId]` loads the engine immediately; the session code
appears in `SessionControls` and the sim sits in `idle` until Start.

**Amendment — where the wizard lives.** The session code does not exist
until `controllerStore.loadScenario()` runs, so "Step 2: connect display"
cannot happen on a separate pre-run route without creating a second place
that owns session lifecycle. Implement the wizard as a **pre-start overlay
or panel on the run page itself** (shown while `status === 'idle'`),
not as a new route. Case selection (original Step 1) stays in `/scenarios`,
which already does that job well — do not duplicate the case-picker inside
the wizard.

The pre-start panel shows, in order:

**Connect student display**

- The 4-character session code, large.
- **Copy join link** button. *New supporting feature:* `/student` must
  accept a `?code=XXXX` query param and auto-join — today the code can only
  be typed manually. Small, high-value change.
- **Open display** button (opens `/student?code=XXXX` in a new tab —
  correct for the common same-device/projector setup via BroadcastChannel).
- Live sync status (reuse `SyncHealthBadge`), with a plain-language note
  that joining from a *different device* requires the cloud realtime
  backend.

**Confirm before start**

- Monitor preview is ticking (it already renders in idle).
- Alarms on/off, NIBP mode (cuff vs art line — surface the "displayed BP is
  last cuff reading" teaching point here instead of only in VitalControls).
- Storage mode in friendly language:
  - **This device only** — Supabase unconfigured or signed out
  - **Cloud sync enabled** — `cloudEligible()` is true
  - **Institution archive enabled** — faculty account with org archive
- Avoid the word "Supabase" anywhere outside `/account` and docs.

The panel must be dismissible in one tap ("Skip — I know this screen") and
must never block the Start button. Faculty relaunching the same case ten
times in an afternoon should not fight a wizard.

## 3. Faculty controller: sticky command bar

**Current state — mostly built.** The run page is *already* the two-column
cockpit the original spec asked for: left = live monitor preview, vital
controls, patient card; right = events, learner actions, notes, log.
(The phase panel and per-system state summary have since been retired —
current phase lives in the sticky command bar.) `SessionControls` already has
the session code, sync badge, Start/Pause, skip-ahead, Reset, and the
confirm-protected **End session → debrief** flow.

The remaining work is focused:

- Make the header (title + `SessionControls` + `ScriptRail`) **sticky** so
  Start/Pause, End, the code, and the next scenario beat stay visible while
  scrolling the panels.
- Add to the bar: **elapsed time** (`snapshot.elapsedSec`, already ticking)
  and **current phase** (`snapshot.phaseId` → label), plus session status
  (idle/running/paused).
- Keep the sticky region short — on an iPad in landscape the monitor
  preview must still be visible below it.

Do **not** rebuild the panel layout; it already matches the intended
design. (A "critical actions always visible" area is covered by item 6.)

## 4. Add vitals presets

> **Removed (2026-07).** Built as specced, then removed before launch: the
> preset target values were clinical content (invariant 7) that never
> received faculty review, and the maintainer chose removal over shipping
> unreviewed numbers. Decision record in `docs/ux-batch-2.md`. The generic
> `applyNamedEffect` engine primitive this section motivated remains, with
> tests, as the extension point for a future reviewed preset pack. The
> section below is kept for history.

**Current state:** the ramp machinery already exists — `setVital(key,
value, overSec)` with 0 s/20 s/1 min/3 min transitions in `VitalControls`,
and `VitalEffect` bundles (vitals + rhythm + capnoShape + `overSec` +
`afterSec`) already power scenario events. A preset is just a named
`VitalEffect[]` applied outside any scenario event — no engine change
needed.

Keep the expert sliders. Add a compact preset row to `VitalControls`.

**Amendment — preset list and clinical review.** Preset target values are
clinical content (invariant 7). Two rules:

1. Ship only **generic physiologic bundles** as global presets, with values
   copied from patterns in the five reviewed scenarios and explicitly
   flagged for faculty review in the PR:
   - Hypotension
   - Desaturation (e.g. SpO₂ ramps toward the low 80s over ~45 s, EtCO₂/RR
     adjusted — final numbers from the reviewed scenarios, not this spec)
   - Bronchospasm (maps to the existing `capnoShape: 'bronchospasm'`
     shark-fin waveform plus the vitals pattern from the anaphylaxis
     scenario)
   - Recovery / Normalize — ramp all numeric vitals back to the loaded
     scenario's `baselineVitals`. Clinically safe by construction and the
     single most useful preset; implement first.
2. **Drop Anaphylaxis, MH, and LAST as global presets.** Those are entire
   reviewed scenarios, not vitals bundles; a one-tap "MH preset" invites
   running the crisis without the scenario's events, actions, and rubric.
   Faculty who want those cases should run the case.

Each preset button: tap to apply; long-press/hover shows a preview of the
effect (targets + ramp time) rendered from the `VitalEffect` data. Presets
respect the currently selected ramp where they don't define their own.
"Customize" means: the sliders remain live — apply a preset, then adjust.

## 5. Extend the script rail (already exists)

**Current state — largely built.** `ScriptRail.tsx` already renders the
"what happens next" strip: next few unfired events, auto events first with
a live countdown (amber flash when imminent), manual events in authored
order, fired-count, and tap-to-fire-now (which cancels the scheduled copy).

Remaining enhancements, in order of value per cost:

- **Preview effects** (pure UI): expand a chip to show the event's
  physiologic effect summarized from its `VitalEffect[]` — targets, ramp,
  delay — plus `description`. No schema change; the data is already there.
- **Delay 1 min** (engine change): requires a `delayEvent(id, sec)` engine
  method that reschedules `autoAtSec` for a pending auto event. Needs
  engine tests. Manual events have nothing to delay — hide the control.
- **Skip** (engine change): mark an event as dismissed so it neither
  auto-fires nor clutters the rail, distinct from "fired". Needs a
  `skippedEventIds` (or similar) field on `SimSnapshot` — snapshot shape
  changes must stay JSON-serializable and are visible to student displays,
  so keep it a plain string array.
- **Current phase** belongs in the sticky command bar (item 3), not on
  every chip.

**Deferred:** "required learner recognition/actions per event" needs an
event→expectedAction link that the scenario schema does not have. That is a
schema change cascading to `types.ts`, `schema.ts`,
`docs/scenario.schema.md`, all five scenarios, and the editor. Do it only
if the debrief "turning points" section (item 7) proves insufficient.

"Reset" already exists in `SessionControls`; it does not belong on the
rail.

## 6. Action scoring: live focus mode + debrief editing

**Current state:** `ActionChecklist` is already tap-to-mark with reversible
statuses grouped by phase, and `DebriefReport` already supports post-hoc
amendment (`amend.markAction`, learner names) with live score
recalculation. The original spec's "two modes" mostly exist — what's
missing is a *low-density live view* and larger targets.

**During sim (enhance `ActionChecklist`):**

- Add a **"Critical only" toggle** (default on while `status === 'running'`)
  that filters to `critical: true` actions so the live list is short.
- Enlarge the four status buttons to comfortable tap targets (≥ 40 px;
  today they are 28 px) at least in critical-only mode.
- Keep labels as plain words on the buttons or beside them — the current
  `✓ ◐ ✗ —` glyphs alone are memory load. Map display labels to the
  existing statuses: Observed → `done`, Delayed → `delayed`, Incorrect →
  `incorrect`, Missed → `missed`. **Do not rename the underlying
  `ActionStatus` values** — they are load-bearing across the engine,
  scoring, schema, and archived sessions.
- No typing during the sim beyond the existing quick-notes panel.

**Debrief edit (enhance `DebriefReport` amend mode):**

- Already there: amending any action status, editing learner names,
  immediate persistence.
- Add: editing/adding faculty notes post-hoc (notes are currently
  read-only after the session).
- **Score adjustments — deferred, needs maintainer sign-off.** The scoring
  policy (done = full, delayed = half, missed/incorrect = 0, criticals
  surfaced separately) is documented and test-covered; a free-form
  adjustment changes the meaning of the score on archived reports. If it
  proves necessary, implement it as a clearly-labelled *faculty adjustment
  line* on the report (stored separately, shown alongside the computed
  score), never as a mutation of the computed score.

## 7. Debrief: narrative report

**Current state — closer than the original spec assumed.** The report
already has: vitals trend strip, score summary with category bars, critical
actions, learner actions grouped by status with timestamps, full timeline,
faculty notes, per-case debrief points and questions, and correct
management/common errors reference — all printable via print CSS.

Remaining work is *reorganization plus one new section*:

- Reframe existing sections under narrative headings, in this order:
  1. **What happened** — trend strip + timeline (already built)
  2. **Key clinical turning points** — *new.* Derive from data already in
     the archive: fired events, phase changes, large/rapid vital ramps from
     `history`, and alarm entries from the log. Pure presentation logic —
     no schema change, no generated clinical text.
  3. **What the learner did** — the existing actions-by-status section
  4. **Missed or delayed actions** — the existing critical-actions section,
     promoted
  5. **Faculty notes** — existing, plus post-hoc editing (item 6)
  6. **Debrief guide** — existing per-case points and questions
- **Amendment — no auto-generated debrief questions.** Generating clinical
  prompts violates invariant 7. Display the scenario-authored
  `debrief.questions` as today. If categorization (Recognition / Diagnosis
  / Treatment / Communication / CRM) is wanted, add an *optional* category
  field to the debrief schema and categorize the five bundled scenarios'
  existing questions by hand for faculty review — schema-change cascade
  applies.
- **Export:** PDF stays the browser Print → Save as PDF flow (print CSS is
  a deliberate invariant — no jsPDF). "Save to archive" already happens
  automatically at session end; the JSON export already exists. No new
  export work.
- Keep the "simulation only — not a clinical record" header line
  (invariant 8).

## 8. Strengthen visual identity

Keep the dark clinical monitor aesthetic; make it more deliberate.

- Use the capnography waveform as the central brand motif (the `⌁⌁⌁`
  placeholder should become a real drawn capnogram mark — the waveform
  renderer in `src/components/monitor/waveforms.ts` can be reused to
  generate it).
- **Amendment — accent color.** The palette in `tailwind.config.ts` already
  reserves clinically-conventional trace colors (`vital.ecg` green,
  `vital.spo2` cyan, `vital.etco2` yellow, etc.). Note that EtCO₂ is
  *yellow* on the monitor, matching convention — do **not** recolor the
  CO₂ trace to match a green/cyan brand. Pick the brand accent (capno
  green `#22e05f` or the spo2 cyan) as a *UI* accent, and leave the
  monitor trace colors alone.
- Reduce decorative emoji in production UI (home-page card icons, `▶ ⏸ ■ ↺
  ✏️ ⬇ 🔔/🔕` in buttons) in favor of consistent inline SVG glyphs — small,
  hand-rolled, no icon-library dependency.
- Improve spacing, hierarchy, and typography within the existing Tailwind
  setup.
- PWA icon: icons are generated — change `scripts/gen-icons.mjs` and run
  `npm run icons`; never hand-edit the PNGs. Verify the mark reads at
  192 px and 512 px, and remember `public/sw.js` `VERSION` must be bumped
  if cached assets change.

Target feel: OR monitor + simulation lab + modern teaching platform.

## 9. Add guided demo case

**Current state:** the recommended demo case already ships —
`laryngospasm-lma` is one of the five bundled scenarios. Nothing else
exists.

Add a one-click **Try the demo** CTA on the homepage that opens
`/faculty/run/laryngospasm-lma` with a guided-tour flag (e.g.
`?demo=1`).

The tour walks through, with dismissible inline coach marks:

1. Starting the session (Start button)
2. Connecting the student display (session code / copy link — item 2)
3. Firing an event from the script rail
4. Changing a vital with a slider + ramp
5. Marking a learner action
6. Ending the session
7. Reading the debrief

Constraints:

- Hand-rolled coach marks — **no tour library** (invariant 6).
- Fully offline; no fetched content.
- Skippable at every step and as a whole; persist "demo seen" under a new
  versioned localStorage key (`capno:demo:v1`), consistent with the
  existing key scheme.
- Tour copy is UI guidance only — any clinical narration must come from
  the scenario's own reviewed text.
- The demo must not bypass `FacultyGate`; it runs as a normal faculty
  session.

---

## Implementation priorities (revised)

Re-ordered for value per cost now that the script rail and cockpit layout
already exist:

1. ✅ **Homepage workflow redesign** (item 1) + **Try the demo** CTA stub
   pointing at the existing case (tour can follow later). — *implemented*
2. ✅ **Quick wins bundle:** sticky command bar with elapsed time + phase
   (item 3); `/student?code=` deep link + copy-link button; critical-only
   toggle and bigger tap targets in `ActionChecklist` (item 6, live half).
   — *implemented*
3. ✅ **Pre-start setup panel** on the run page (item 2). — *implemented*
4. ⊘ **Vitals presets** (item 4) — *implemented, then removed pre-launch:
   the preset targets never received faculty review (invariant 7). See the
   decision record in `docs/ux-batch-2.md`.*
5. ⊘ **Script rail enhancements** (item 5) — *superseded.* Preview effects
   shipped with the Flow panel; the delay/skip engine changes are no longer
   justified now that autos are manual-by-default, `pinNextEvent` redirects
   pacing, and ad-hoc events cover improvisation. Decision record in
   `docs/ux-batch-2.md`.
6. ✅ **Debrief narrative reorganization** + turning-points section (item 7)
   and post-hoc note editing (item 6, debrief half). — *implemented; see
   `docs/ux-batch-2.md`*
7. ✅ **Guided demo tour** (item 9) — *implemented; see `docs/ux-batch-2.md`.*
   ✅ **Visual identity pass** (item 8) — *shipped with the brand work
   (capnogram mark, icons, OG image).*

Every step lands as small commits with `npm test`, `npm run typecheck`,
and `npm run build` green, plus the manual two-tab sync smoke test for
anything touching the controller, monitor, or sync.

## Success criteria

The improved UX should allow a new faculty user to:

- Understand the product within 10 seconds of landing on the homepage
- Launch the demo case without reading documentation
- Connect a student display with minimal confusion (one code or one link)
- Run a scenario without hunting for controls (start/pause/end and the
  next scenario beat always visible)
- Score critical actions during the sim with one tap each
- Amend scoring after the sim before sharing the report
- Produce a useful debrief report immediately after the session

Guiding principle: **CAPNO Studio should reduce instructor cognitive load
during simulation, not add to it.**
