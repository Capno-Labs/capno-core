---
name: verify
description: Build, launch, and drive Capno in a browser to verify changes end-to-end (dev server + Playwright against the faculty controller and student monitor).
---

# Verifying Capno changes at runtime

## Launch

```bash
npm ci                 # fresh containers have no node_modules
npm run dev            # serves http://localhost:3000, ready in ~5s
```

No faculty PIN is required unless `NEXT_PUBLIC_FACULTY_PIN` is set — the
FacultyGate renders children directly.

## Drive (Playwright)

Use the preinstalled global Playwright + Chromium (do NOT `playwright install`):

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
```

The canonical smoke flow:

1. Faculty page: `goto /faculty/run/anaphylaxis` (or `/faculty/run/quick-start`
   for a no-events session). The 4-char session code is in the
   `.font-mono.text-xl` element. Click `[data-tour="start"]` (event labels
   can contain "start" too, so a `/start/i` button match is ambiguous).
2. Student page: **same browser context** (BroadcastChannel only spans one
   profile), `goto /student`, fill `getByLabel('Session code')`, click
   `/join/i`. Assert monitor content via `document.body.innerText`.
3. Sliders: range inputs are `getByLabel('<label> target')`, the typed boxes
   are `getByLabel('<label> typed target')` (labels from VITAL_META, e.g.
   `HR`, `Et Agent`). Ramp preset buttons: `Instant`, `3 s`, `10 s`.
4. Rhythm/CO₂ buttons are named by their RHYTHM_LABELS / CAPNO_SHAPE_LABELS
   text (e.g. `Sinus with PVCs`).
6. Alarm setup: on the faculty preview, click the tile (`getByRole('button',
   { name: 'HR alarm setup' })`); the dialog (`Alarm setup`) has
   `Raise/Lower HR high alarm limit` buttons and an `HR alarms on — switch
   off` toggle. The tile's limits text, or 🔕, follows.
   The same works on a joined student display (same browser context) while
   `Learners can do the same on their display` is ticked on the controller;
   the log line then ends `on a student display`.
   `getByRole('button', { name: 'Silence alarms' })` is the monitor's Silence
   key (disabled with nothing alarming); a silenced alarm shows `✓` in the
   alarm bar. The faculty-only toggle above the preview is `pause all alarms`.
5. Twitch monitor: click `Attach twitch monitor`; the steppers are
   `getByLabel('Count target')`, `Ratio target` (only at count 4) and
   `PTC target` (only at count 0). The TOF tile changes at the next
   measurement — click `Stimulate now` rather than waiting 15 s.
7. Flow rail: each event is `[data-flow-card="<event id>"]` with
   `data-flow-state` = `next | upcoming | watching | done`. An unfired
   event's fire button is the one whose `title` is the event description
   (`button[title="…"]`); a fired event's header is a toggle
   (`aria-expanded`), and re-firing is `Fire again` inside it. Action rows
   render only in open cards — press `Show all` (`aria-pressed`) to render
   every `getByLabel('<action>: Observed')`; a marked row folds after ~2 s
   into a `Change mark — <action>` button. `N` fires the next event from
   anywhere except a text field or an open dialog (no need to blur a button
   first).
8. Layout: at ≥1440×700 (or ≥1024×900) the controller fits the window — the
   page does not scroll (`document.documentElement.scrollHeight <=
   innerHeight`) and the Flow list, the vitals rail and the Notes/Log lists
   scroll on their own. Smaller windows scroll the page as before.

## Run-sheet import flow

1. `goto /scenarios/import`, fill `getByLabel('Run sheet text')` with the
   contents of `src/lib/import/fixtures/sample-airway-guide.md`, click
   `/review pasted text/i`. The review page (`/scenarios/import?source=…`)
   shows two scenario tabs, a **Review queue** pill with the unresolved
   count, and the source blocks on the left.
2. Hover/click a field's `source bN` link → block `#block-bN` gets
   `ring-brand`. `Save to library` stays disabled until the queue is empty;
   vitals and patient demographics must be typed by hand (never defaulted).
3. After saving, `/editor?id=<slug>` opens with the `imported` tag; running
   it and ending the session gives a session record whose action table has a
   **Rubric descriptors** column (all actions have 0 points) under a count
   line (`[data-action-counts]`, "N of M expected actions done…"). No score
   appears anywhere in the studio.

## Debrief walkthrough

After `Confirm end → debrief` the session record opens (`/debrief/<id>`).
`getByRole('button', { name: 'Start debrief' })` opens the walkthrough: a
`[data-debrief-deck]` overlay portalled to `<body>`, with the rest of the
page `inert`. The current card is `[data-card]` (its id; `data-card-kind` is
`scene`, `prompt`, `timeline`, `list`, `plusDelta`, `doneWell`, `gap`,
`otherGaps`, `question`, `takeaways` or `end`). Keys go to `window`:
`ArrowRight`/`ArrowLeft`/`PageDown`/`PageUp`/`Home`/`End` move, `n` toggles
`[data-deck-cue]`, `Escape` closes. One `gap` card exists per critical action
not marked done — amend a status on the record and reopen to see it go. On
the `takeaways` card, `getByLabel('Add a take-away')` + `Add` saves a
post-hoc faculty note prefixed `Take-away: `.

## Gotchas

- The waveform is a sweep display that redraws in place: after changing HR or
  rhythm, **stale trace persists up to one full sweep (~12 s at 90 px/s)**.
  For clean waveform screenshots, set the state first, wait ≥13 s, then
  screenshot `page.locator('canvas').first()`.
- Displayed BP is the last NIBP cuff reading by design — don't expect the BP
  tile to follow SBP/DBP sliders live (see CLAUDE.md).
- The HR tile is counted from drawn beats: in sinus rhythm it can read one
  either side of the slider value, and in AF several — assert a range, not an
  exact number. SVT, VT and PEA are metronomic and read exactly.
- In VF/PEA/asystole the SpO₂ tile reads `--`; after a cuff cycle
  below 30 mmHg systolic the NIBP tile reads `--/--`.
