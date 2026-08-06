---
name: demo-reel
description: Launch Capno and capture a demo reel — storyboarded 1200×750 PNG screenshots plus Playwright-recorded WebM video of a scripted laryngospasm-lma session (case library → faculty controller → student monitor → scored debrief). Use when asked for demo media, marketing screenshots, or a walkthrough video.
---

# Producing a Capno demo reel

Run the committed driver script to film a scripted session end-to-end.
Outputs land in `demo-reel-out/` at the repo root (gitignored): ten
numbered PNG stills, exactly 1200×750 (16:10) so they are drop-in usable
for the capno-www marketing site, plus two WebM screen recordings.

## Launch

```bash
npm ci                 # fresh containers have no node_modules
npm run dev            # http://localhost:3000, ready in ~5s
```

For final marketing assets prefer `npm run build && npm run start` — same
port, no dev-mode compile indicators in frame. No faculty PIN is required
unless `NEXT_PUBLIC_FACULTY_PIN` is set. The `verify` skill documents the
underlying selector conventions.

## Run the capture

```bash
node .claude/skills/demo-reel/capture.mjs
```

`CAPNO_URL` overrides the server (default `http://localhost:3000`). The
sim runs in real time, so a run takes ~5 minutes and logs each beat. The
script self-checks its outputs (still dimensions, video sizes) and exits
non-zero on failure. If a selector has drifted, fix `capture.mjs` against
the component source — don't work around it inline.

## Storyboard

| Beat | What happens | Still |
| --- | --- | --- |
| Landing | `/` with the simulation-only disclaimer | `01-landing.png` |
| Case library | `/scenarios` | `02-case-library.png` |
| Pre-start | controller idle, session code visible | `03-controller-prestart.png` |
| Student joins | second page joins by code | — |
| Induction | start; propofol → LMA → sevoflurane via `N` | `04-controller-baseline.png` |
| Partial spasm | SpO₂ drifts, capnograph shrinks | — |
| Obstruction | flat capnograph, desat toward 76 | `05-controller-obstruction.png` |
| Student cutaway | mirrored monitor mid-crisis | `06-student-monitor.png` |
| Bradycardia | HR 42, sinus brady | — |
| Mark actions | 9 learner actions marked Observed | — |
| Recovery | CPAP → propofol → sux/intubation → full recovery | `07-controller-recovery.png` |
| Debrief | end session → scored report (86%) | `08-debrief.png` |
| Archive | `/debrief` list | `09-debrief-archive.png` |
| Tour | coach-mark walkthrough via `?demo=1` | `10-demo-tour.png` |

## How the capture works

The mechanics a future session needs before modifying `capture.mjs`:

- **Geometry:** viewport 1600×1000 with `deviceScaleFactor: 0.75` gives
  exact 1200×750 screenshots while the controller still renders its full
  two-column cockpit (which needs ≥1600px CSS width).
- **One browser context** holds both the faculty and student pages —
  BroadcastChannel sync spans a single profile only. The student page is
  passive by design; everything is driven from the controller.
- **Video:** `recordVideo` on the context produces one WebM per page.
  Files are final only after `context.close()`; the script grabs
  `page.video().path()` first, then copies to stable names.
- **Events:** auto events default to off, so the script paces the case
  itself — `N` fires the next unfired event in narrative order (the
  keyboard hook ignores keys while a button has focus, so blur first).
  The one exception is `full-recovery`, clicked by card (matched on the
  button's `title` = event description) because a blind `N` would fire
  the optional `nppe-complication` event that precedes it.
- **Tour:** the seen-flag `capno:demo:v1` is pre-seeded via
  `addInitScript` so coach marks never occlude the main pass; the tour
  still comes from a throwaway context with the flag cleared and
  `?demo=1`.

## Outputs

`demo-reel.webm` (faculty page — the primary reel, ~4 min) and
`student-monitor.webm` (B-roll from the join onward). Four stills map to
the capno-www marketing set:

| Still | capno-www name |
| --- | --- |
| `02-case-library.png` | `case-library.png` |
| `05-controller-obstruction.png` | `faculty-controller.png` |
| `06-student-monitor.png` | `student-monitor.png` |
| `08-debrief.png` | `debrief.png` |

capno-www's committed PNGs are additionally palette-quantized to
50–105 KB; that post-processing is downstream work, not this skill's.
So is video trimming/speed-up — no ffmpeg here (no new dependencies).

## Verifying the reel

Beyond the script's own dimension/size checks, eyeball the shots (Read
the PNGs): the obstruction still shows a flat capnograph with SpO₂ in
the 80s and falling; the student still mirrors it; the debrief still
shows a non-zero score and the simulation-only disclaimer; the tour
still shows the coach-mark dialog. `git status` should show nothing —
`demo-reel-out/` is gitignored.

## Gotchas

- The waveform is a sweep display redrawn in place: stale trace persists
  up to one full sweep (~12 s at 90 px/s). Set state, wait ≥13 s, then
  capture — this dominates the reel's pacing.
- The BP tile shows the last NIBP cuff reading with a staleness
  subtitle. That's the teaching point, not a bug — don't fight it.
- `beforeunload` is armed while a session is running or paused. The
  script ends the session in-app (End → Confirm routes to the debrief),
  so it never trips; keep that ordering if you reshoot manually.
- The end-session ConfirmButton auto-cancels after 6 s — click the
  confirm step promptly.
- The Flow panel auto-arms its "Critical only" filter when the session
  starts running, hiding non-critical action rows — disarm it before
  marking the full action list.
- Videos are silent: Playwright records video only, and headless Chromium
  plays no monitor audio. Nobody should debug "missing beeps".
- The "Simulation only — not for clinical use" disclaimer must stay
  visible in the landing and debrief shots (CLAUDE.md invariant 8).
