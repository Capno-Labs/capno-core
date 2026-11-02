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
   `.font-mono.text-xl` element. Click the button matching `/start/i`.
2. Student page: **same browser context** (BroadcastChannel only spans one
   profile), `goto /student`, fill `getByLabel('Session code')`, click
   `/join/i`. Assert monitor content via `document.body.innerText`.
3. Sliders: range inputs are `getByLabel('<label> target')`, the typed boxes
   are `getByLabel('<label> typed target')` (labels from VITAL_META, e.g.
   `HR`, `Et Sev`). Ramp preset buttons: `Instant`, `3 s`, `10 s`.
4. Rhythm/CO₂ buttons are named by their RHYTHM_LABELS / CAPNO_SHAPE_LABELS
   text (e.g. `Sinus with PVCs`).

## Run-sheet import flow

1. `goto /scenarios/import`, fill `getByLabel('Run sheet text')` with the
   contents of `src/lib/import/fixtures/sample-airway-guide.md`, click
   `/review pasted text/i`. The review page (`/scenarios/import?source=…`)
   shows two scenario tabs, a **Review queue** pill with the unresolved
   count, and the source blocks on the left.
2. Hover/click a field's `source bN` link → block `#block-bN` gets
   `ring-amber`. `Save to library` stays disabled until the queue is empty;
   vitals and patient demographics must be typed by hand (never defaulted).
3. After saving, `/editor?id=<slug>` opens with the `imported` tag; running
   it and ending the session gives a debrief that reads
   **Faculty-scored rubric — no automatic score** (all actions have 0 points).

## Gotchas

- The waveform is a sweep display that redraws in place: after changing HR or
  rhythm, **stale trace persists up to one full sweep (~12 s at 90 px/s)**.
  For clean waveform screenshots, set the state first, wait ≥13 s, then
  screenshot `page.locator('canvas').first()`.
- Displayed BP is the last NIBP cuff reading by design — don't expect the BP
  tile to follow SBP/DBP sliders live (see CLAUDE.md).
