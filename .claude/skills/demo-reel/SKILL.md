---
name: demo-reel
description: Launch Capno and capture a demo reel — storyboarded 1200×750 PNG screenshots plus Playwright-recorded WebM video of a scripted laryngospasm-lma session (case library → faculty controller → student monitor → scored debrief). Use when asked for demo media, marketing screenshots, or a walkthrough video.
---

# Producing a Capno demo reel

Run the committed driver script to film a scripted session end-to-end.
`capture.mjs` is the source of truth for the storyboard (ten numbered
stills + two WebM recordings), geometry, and selectors — read it before
changing anything; don't re-derive its choreography from prose here.

## Launch and run

```bash
npm ci                 # fresh containers have no node_modules
npm run dev            # http://localhost:3000; prefer build+start for final assets
node .claude/skills/demo-reel/capture.mjs
```

`CAPNO_URL` overrides the server. The sim runs in real time (~5 min),
logs each beat, self-checks output dimensions/sizes, and exits non-zero
on failure. If a selector has drifted, fix `capture.mjs` against the
component source — don't work around it inline. Outputs land in
`demo-reel-out/` (gitignored; `git status` should stay clean).

Four stills feed the capno-www marketing set: `02-case-library`,
`05-controller-obstruction` (→ `faculty-controller`),
`06-student-monitor`, `08-debrief`. www's committed copies are
palette-quantized downstream — not this skill's job, and no ffmpeg here
(no new dependencies).

## Gotchas (the non-derivable parts)

- The waveform is a sweep display redrawn in place: stale trace persists
  up to one full sweep (~12 s at 90 px/s). Set state, wait ≥13 s, then
  capture — this dominates the reel's pacing.
- Auto events are off; the script paces the case with `N` (fires the next
  unfired event in narrative order; blur focused buttons first). The one
  exception is `full-recovery`, clicked by card — a blind `N` would fire
  the optional `nppe-complication` event that precedes it.
- The tour seen-flag `capno:demo:v1` is pre-seeded via `addInitScript` so
  coach marks never occlude the main pass; the tour shot uses a throwaway
  context with the flag cleared and `?demo=1`.
- The BP tile shows the last NIBP cuff reading with a staleness subtitle —
  teaching point, not a bug.
- The end-session ConfirmButton auto-cancels after 6 s; end the session
  in-app (End → Confirm) so the armed `beforeunload` never trips.
- The Flow panel auto-arms its "Critical only" filter at session start —
  disarm it before marking the full action list.
- Videos are silent (Playwright records no audio) — don't debug
  "missing beeps".
- The "Simulation only — not for clinical use" disclaimer must stay
  visible in the landing and debrief shots (CLAUDE.md invariant 8).
