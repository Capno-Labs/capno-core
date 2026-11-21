import type { Rhythm } from '@/lib/engine/types';

/**
 * Shared heartbeat scheduler for one monitor.
 *
 * Every pulsatile thing on the monitor — the ECG trace, the pleth, the
 * arterial line and the pulse tone — reads beats from the same clock, so a
 * QRS, its beep and its pulse wave belong to the same heartbeat. Before this,
 * each trace advanced its own phase and the tone ran on its own timer.
 *
 * Display-only, like the waveform generators: it never feeds back into the
 * engine. The HR number stays the instructor's value; the clock only decides
 * *when* each beat falls. Ectopy and AF patterns are normalized to a mean
 * interval of 60/HR so the drawn rate agrees with the displayed number.
 *
 * Framework-free and deterministic for a given seed, so it tests in Node.
 */

export type BeatKind = 'normal' | 'pvc' | 'pac';

export interface Beat {
  /** Running count of beats since the clock was created. */
  index: number;
  /** Clock time (seconds) at which this beat's cycle begins. */
  startSec: number;
  /** Interval to the next beat, in seconds. */
  rrSec: number;
  /** Mean cycle length (60/HR) when the beat was scheduled — what rate-adapted
   *  timings (T wave, pulse wave) follow, rather than this beat's own interval. */
  baseSec: number;
  /** Rhythm in force when the beat was scheduled. */
  rhythm: Rhythm;
  kind: BeatKind;
  /** Relative stroke strength for the pleth / arterial pulse, ~0.35–1.1. */
  pulse: number;
}

export interface BeatClockInput {
  hr: number;
  rhythm: Rhythm;
  /** One PVC per N beats while the rhythm is `pvc`. */
  pvcEveryN: number;
  /** Scenario paused / not started: the clock holds still. */
  frozen: boolean;
}

/** Rhythms with no discrete beats — drawn from absolute time instead. */
const NON_BEATING: ReadonlySet<Rhythm> = new Set(['vfib', 'asystole']);

/** A premature ventricular beat falls early, then a full compensatory pause:
 *  the two intervals around it add up to two normal cycles. */
const PVC_COUPLING = 0.6;
const PVC_PAUSE = 2 - PVC_COUPLING;
/** A premature atrial beat resets the sinus node, so its pause is shorter
 *  than compensatory. */
const PAC_COUPLING = 0.75;
const PAC_PAUSE = 1.1;
const PAC_EVERY_N = 5;
/** AF: each interval is drawn uniformly from this range (mean 1). */
const AF_MIN = 0.6;
const AF_MAX = 1.4;

/** Weak, poorly filled ventricular ectopic. */
const PVC_PULSE = 0.35;

/** Beats kept for tails that outlast their own cycle (T wave, pulse wave). */
const KEEP_BEATS = 8;
/** Longest gap one tick() will catch up; longer gaps (hidden tab) are dropped. */
const MAX_CATCH_UP_SEC = 2;
const STEP_SEC = 0.05;

/** mulberry32 — tiny deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export class BeatClock {
  /** Clock time in seconds. Advances only while not frozen. */
  t = 0;

  private input: BeatClockInput = { hr: 0, rhythm: 'sinus', pvcEveryN: 4, frozen: true };
  private readonly rand: () => number;
  private beats: Beat[] = [];
  private nextAt: number | null = null;
  private started = 0;
  private prevFactor = 1;
  private lastMs: number | null = null;

  constructor(seed = 1) {
    this.rand = prng(seed);
  }

  /** Latest vitals. Cheap — call on every render. */
  setInput(input: BeatClockInput): void {
    this.input = input;
  }

  /** Total beats started so far (lets a listener notice new ones). */
  get count(): number {
    return this.started;
  }

  /** The most recent beats, oldest first. */
  recent(): readonly Beat[] {
    return this.beats;
  }

  /**
   * Advance to a wall-clock timestamp (ms, `performance.now()` timebase).
   * Safe to call from several consumers per frame: a timestamp at or before
   * the last one is a no-op.
   */
  tick(nowMs: number): void {
    if (this.lastMs === null) {
      this.lastMs = nowMs;
      return;
    }
    if (nowMs <= this.lastMs) return;
    let remaining = Math.min(MAX_CATCH_UP_SEC, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    while (remaining > 0) {
      const step = Math.min(STEP_SEC, remaining);
      this.advance(step);
      remaining -= step;
    }
  }

  /** Advance clock time directly by `dtSec` (what tick() does in small steps). */
  advance(dtSec: number): void {
    if (this.input.frozen || dtSec <= 0) return;
    this.t += dtSec;

    const { hr, rhythm } = this.input;
    if (NON_BEATING.has(rhythm)) {
      // Fibrillation / standstill: no complexes, and nothing left over from
      // the organized rhythm that preceded it.
      this.beats = [];
      this.nextAt = null;
      return;
    }
    if (hr <= 0) {
      this.nextAt = null;
      return;
    }

    const base = 60 / hr;
    if (this.nextAt === null) {
      this.nextAt = this.t;
    } else if (this.nextAt - this.t > base * 1.5) {
      // The rate rose sharply since the pending beat was scheduled (e.g. 20 →
      // 120 bpm): don't sit out the old long interval.
      this.nextAt = this.t + base;
      const last = this.beats[this.beats.length - 1];
      if (last) last.rrSec = this.nextAt - last.startSec;
    }
    while (this.nextAt <= this.t) {
      this.nextAt = this.startBeat(this.nextAt, base);
    }
  }

  /** Schedule one beat at `at`; returns when the following beat is due. */
  private startBeat(at: number, base: number): number {
    const { rhythm, pvcEveryN } = this.input;
    const index = this.started;
    let kind: BeatKind = 'normal';
    let factor = 1;

    if (rhythm === 'pvc') {
      const n = Math.max(2, Math.round(pvcEveryN));
      const pos = index % n;
      if (pos === n - 1) {
        kind = 'pvc';
        factor = PVC_PAUSE;
      } else if (pos === n - 2) {
        factor = PVC_COUPLING;
      }
    } else if (rhythm === 'pac') {
      const pos = index % PAC_EVERY_N;
      const mean = (PAC_EVERY_N - 2 + PAC_COUPLING + PAC_PAUSE) / PAC_EVERY_N;
      if (pos === PAC_EVERY_N - 1) {
        kind = 'pac';
        factor = PAC_PAUSE / mean;
      } else if (pos === PAC_EVERY_N - 2) {
        factor = PAC_COUPLING / mean;
      } else {
        factor = 1 / mean;
      }
    } else if (rhythm === 'afib') {
      factor = AF_MIN + (AF_MAX - AF_MIN) * this.rand();
    }

    // Stroke strength follows filling time: a beat that comes early after the
    // previous one ejects less, the beat after a pause ejects more.
    const pulse = kind === 'pvc' ? PVC_PULSE : clamp(0.4 + 0.6 * this.prevFactor, 0.5, 1.1);
    this.prevFactor = factor;

    const rrSec = factor * base;
    this.beats.push({ index, startSec: at, rrSec, baseSec: base, rhythm, kind, pulse });
    if (this.beats.length > KEEP_BEATS) this.beats.shift();
    this.started += 1;
    return at + rrSec;
  }
}
