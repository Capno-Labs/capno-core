#!/usr/bin/env node
/**
 * Demo-reel capture driver — storyboard and usage in SKILL.md next to this
 * file. Drives a scripted laryngospasm-lma session against a running app
 * server and writes 1200×750 PNG stills plus WebM videos (faculty + student)
 * to demo-reel-out/ at the repo root.
 *
 * Usage:  node .claude/skills/demo-reel/capture.mjs
 * Env:    CAPNO_URL  server to capture (default http://localhost:3000)
 *
 * Zero project dependencies: uses the container's global Playwright and its
 * preinstalled Chromium. The sim runs in real time, so a full run takes
 * ~5 minutes. If a selector here has drifted from the components, fix this
 * script against the component source — don't work around it inline.
 */
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.CAPNO_URL ?? 'http://localhost:3000';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = join(ROOT, 'demo-reel-out');
const VIDEO_TMP = join(OUT, '.video-tmp');
const SCENARIO = 'laryngospasm-lma';

// Viewport is CSS pixels; screenshots are viewport × deviceScaleFactor, so
// 1600×1000 @ 0.75 yields exact 1200×750 stills (the capno-www marketing
// convention) while the controller still lays out its full ≥1600px cockpit.
const VIEWPORT = { width: 1600, height: 1000 };
const SCALE = 0.75;

// The tour seen-flag (src/lib/demoTour.ts). Pre-seeded so the coach marks
// never occlude the cockpit; cleared in the separate tour-still context.
const DEMO_SEEN_KEY = 'capno:demo:v1';
const DEMO_SEEN_VALUE = JSON.stringify({ seenAtIso: '2026-01-01T00:00:00.000Z' });

// Expected-action labels from src/scenarios/laryngospasm-lma.json, marked
// via the ActionMarkRow buttons (aria-label = `${label}: Observed`). The six
// critical actions plus three supporting ones → debrief scores 86% (125/145); the two
// left unmarked read as missed, which keeps the report honest-looking.
const OBSERVED_ACTIONS = [
  'Identify elevated laryngospasm risk (recent URI, smoker) and verbalize a plan',
  'Confirm LMA placement with capnography and chest rise',
  'Recognize laryngospasm (stridor/silent chest, lost capnograph, falling SpO2) and announce it',
  'Call for help early in the airway emergency',
  "Apply 100% O2 with sustained CPAP and jaw thrust at Larson's point",
  'Remove the stimulus and deepen anesthesia with propofol 0.5-1 mg/kg IV',
  'Give succinylcholine 0.5-1 mg/kg IV for refractory spasm',
  'Prepare to intubate (laryngoscope, ETT, suction ready) once paralyzed',
  'Escalate before profound hypoxia; recognize and treat hypoxic bradycardia',
];

// full-recovery is fired by clicking its card (matched on the button's
// title attribute = the event description) because a blind N press would
// fire the optional nppe-complication event that sits before it.
const FULL_RECOVERY_TITLE =
  'Oxygenation, ventilation, and hemodynamics return to normal on appropriate support; the team plans disposition and monitoring.';

const t0 = Date.now();
const log = (msg) =>
  console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s] ${msg}`);
const wait = (sec) => new Promise((r) => setTimeout(r, sec * 1000));

/** The keyboard hook ignores keys while a button/input has focus — blur first. */
async function pressKey(page, key) {
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  });
  await page.keyboard.press(key);
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  log(`still  ${name}`);
}

/** Width/height straight from the PNG IHDR chunk (bytes 16-23). */
async function pngSize(path) {
  const buf = await readFile(path);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(VIDEO_TMP, { recursive: true });

  const browser = await chromium.launch();
  try {
    // Warm-up pass: compile/caches for every route we film, so the recorded
    // pass has no first-hit lag (matters most against `npm run dev`).
    log('warm-up pass');
    const warm = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const wp = await warm.newPage();
    for (const path of ['/', '/scenarios', `/faculty/run/${SCENARIO}`, '/student', '/debrief']) {
      await wp.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60_000 });
    }
    await warm.close();

    // Main recorded pass. One context for both pages: BroadcastChannel sync
    // spans a single browser profile only. recordVideo writes one WebM per
    // page; both are harvested after context.close().
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      recordVideo: { dir: VIDEO_TMP, size: VIEWPORT },
    });
    await ctx.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [DEMO_SEEN_KEY, DEMO_SEEN_VALUE],
    );
    const faculty = await ctx.newPage();

    // Beat 1-2: landing (disclaimer visible) and case library.
    await faculty.goto(`${BASE}/`);
    await wait(2);
    await shot(faculty, '01-landing.png');
    await faculty.goto(`${BASE}/scenarios`);
    await wait(2);
    await shot(faculty, '02-case-library.png');

    // Beat 3: controller pre-start; grab the 4-char session code.
    await faculty.goto(`${BASE}/faculty/run/${SCENARIO}`);
    await faculty.locator('[data-tour="start"]').waitFor();
    await wait(2);
    const code = (await faculty.locator('.font-mono.text-xl').first().innerText()).trim();
    log(`session code ${code}`);
    await shot(faculty, '03-controller-prestart.png');

    // Beat 4: student joins in a second page of the same context.
    const student = await ctx.newPage();
    await student.goto(`${BASE}/student`);
    await student.getByLabel('Session code').fill(code);
    await student.getByRole('button', { name: /join/i }).click();
    await wait(2);

    // Beat 5: start, then fire induction → LMA → sevoflurane with N (fires
    // the next unfired event in narrative order). Wait out one full waveform
    // sweep (~12 s at 90 px/s) so the trace is clean before the still.
    await faculty.bringToFront();
    await faculty.locator('[data-tour="start"]').click();
    log('session started');
    for (let i = 0; i < 3; i++) {
      await wait(3);
      await pressKey(faculty, 'n');
    }
    log('induction events fired');
    await wait(14);
    await shot(faculty, '04-controller-baseline.png');

    // Beat 6: partial laryngospasm (SpO2→92, EtCO2→22 over 90 s) — capture
    // pacing mid-ramp is the point, so no still until obstruction.
    await pressKey(faculty, 'n');
    log('partial laryngospasm');
    await wait(35);

    // Beat 7: complete laryngospasm — 15 s ramp to EtCO2 0 / RR 0, then the
    // desat toward 76 over 120 s. ~45 s in, the capnograph is flat and SpO2
    // is in the mid-80s and visibly falling.
    await pressKey(faculty, 'n');
    log('complete laryngospasm');
    await wait(45);
    await shot(faculty, '05-controller-obstruction.png');

    // Beat 8: student-monitor cutaway while the obstruction holds.
    await student.bringToFront();
    await wait(4);
    await shot(student, '06-student-monitor.png');

    // Beat 9: hypoxic bradycardia (HR 42, sinus_brady over 60 s).
    await faculty.bringToFront();
    await pressKey(faculty, 'n');
    log('hypoxic bradycardia');
    await wait(15);

    // Beat 10: mark learner actions. The Flow panel auto-arms its
    // "Critical only" filter when the session starts running, which hides
    // the non-critical rows — disarm it first. Rows render in two panel
    // sections, so .first() disambiguates; one click sets the status.
    const critBtn = faculty.getByRole('button', { name: 'Critical only' });
    if ((await critBtn.getAttribute('aria-pressed')) === 'true') await critBtn.click();
    for (const label of OBSERVED_ACTIONS) {
      await faculty.getByLabel(`${label}: Observed`).first().click();
    }
    log('actions marked');

    // Beat 11: recovery. The next three unfired events in narrative order
    // are exactly the response events, so N is safe; full-recovery is
    // clicked by card to skip the optional NPPE event before it.
    await pressKey(faculty, 'n'); // cpap-jaw-thrust-response
    await wait(10);
    await pressKey(faculty, 'n'); // deepen-propofol-response
    await wait(20);
    await pressKey(faculty, 'n'); // succinylcholine-reintubation
    await wait(20);
    await faculty.locator(`button[title=${JSON.stringify(FULL_RECOVERY_TITLE)}]`).click();
    log('recovery fired');
    await wait(25);
    // Marking actions auto-scrolled the page; bring the cockpit back in
    // frame before the recovery still.
    await faculty.evaluate(() => window.scrollTo({ top: 0 }));
    await wait(1);
    await shot(faculty, '07-controller-recovery.png');

    // Beat 12: end the session in-app (two-step ConfirmButton; the confirm
    // state auto-cancels after 6 s, so click promptly). endAndArchive routes
    // to the debrief, so the armed beforeunload never fires.
    await faculty.getByRole('button', { name: '■ End session' }).click();
    await faculty.getByRole('button', { name: 'Confirm end → debrief' }).click();
    await faculty.waitForURL('**/debrief/**');
    await wait(3);
    await shot(faculty, '08-debrief.png');

    // Beat 13: scroll the scored report for the video tail, then the archive.
    for (let i = 0; i < 8; i++) {
      await faculty.mouse.wheel(0, 400);
      await wait(0.7);
    }
    await faculty.goto(`${BASE}/debrief`);
    await wait(3);
    await shot(faculty, '09-debrief-archive.png');
    await wait(2);

    // Flush videos: paths are known before close, files are final after.
    const facultyVideo = await faculty.video().path();
    const studentVideo = await student.video().path();
    await ctx.close();
    await copyFile(facultyVideo, join(OUT, 'demo-reel.webm'));
    await copyFile(studentVideo, join(OUT, 'student-monitor.webm'));
    await rm(VIDEO_TMP, { recursive: true, force: true });
    log('videos harvested');

    // Beat T: tour still from a throwaway non-video context with the
    // seen-flag cleared so ?demo=1 self-opens the coach marks.
    const tourCtx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const tour = await tourCtx.newPage();
    await tour.goto(`${BASE}/faculty/run/${SCENARIO}?demo=1`);
    await tour.getByRole('dialog', { name: /^Demo tour:/ }).waitFor();
    await wait(1);
    await shot(tour, '10-demo-tour.png');
    await tourCtx.close();
  } finally {
    await browser.close();
  }

  // Self-check: every still is exactly 1200×750; both videos are real files.
  let failed = false;
  const stills = [
    '01-landing.png',
    '02-case-library.png',
    '03-controller-prestart.png',
    '04-controller-baseline.png',
    '05-controller-obstruction.png',
    '06-student-monitor.png',
    '07-controller-recovery.png',
    '08-debrief.png',
    '09-debrief-archive.png',
    '10-demo-tour.png',
  ];
  for (const name of stills) {
    const { w, h } = await pngSize(join(OUT, name));
    if (w !== 1200 || h !== 750) {
      console.error(`FAIL ${name}: ${w}×${h}, expected 1200×750`);
      failed = true;
    }
  }
  for (const name of ['demo-reel.webm', 'student-monitor.webm']) {
    const { size } = await stat(join(OUT, name));
    if (size < 100_000) {
      console.error(`FAIL ${name}: only ${size} bytes`);
      failed = true;
    }
    log(`video  ${name} (${Math.round(size / 1024)} KB)`);
  }
  if (failed) process.exit(1);
  log(`done → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
