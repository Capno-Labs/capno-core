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
   `HR`, `Et Sev`). Ramp preset buttons: `Instant`, `20 s`, `1 min`, `3 min`.
4. Rhythm/CO₂ buttons are named by their RHYTHM_LABELS / CAPNO_SHAPE_LABELS
   text (e.g. `Sinus with PVCs`).

## Gotchas

- The waveform is a sweep display that redraws in place: after changing HR or
  rhythm, **stale trace persists up to one full sweep (~12 s at 90 px/s)**.
  For clean waveform screenshots, set the state first, wait ≥13 s, then
  screenshot `page.locator('canvas').first()`.
- Displayed BP is the last NIBP cuff reading by design — don't expect the BP
  tile to follow SBP/DBP sliders live (see CLAUDE.md).
