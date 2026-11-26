import type { Rhythm } from '@/lib/engine/types';

/**
 * Shared heartbeat and breath scheduler for one monitor.
 *
 * Every pulsatile thing on the monitor — the ECG trace, the pleth, the
 * arterial line and the pulse tone — reads beats from the same clock, so a
 * QRS, its beep and its pulse wave belong to the same heartbeat. The clock
 * also carries the breath phase the capnogram draws from, so the small
 * respiratory swing in the pulse traces keeps step with the breaths on screen.
 *
 * Display-only, like the waveform generators: it never feeds back into the
 * engine, and alarms are still judged on the instructor's values. The clock
 * only decides *when* each beat falls. Every pattern (ectopy, AF, the slight
 * beat-to-beat variation of sinus rhythm) averages to an interval of 60/HR,
 * so the drawn rate agrees with the instructor's number.
 *
 * Framework-free and deterministic for a given seed, so it tests in Node.
 */

export type BeatKind = 'normal' | 'pvc' | 'pac';

/** A beat's cycle begins a little before its P wave, which peaks here (ms). */
export const P_MS = 60;
/** Where the R wave falls in a normally conducted beat, ms from its start. */
export const R_MS = 210;

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
  /** This beat's interval as a multiple of the mean cycle (1 = on the beat). */
  factor: number;
  /** Rhythm in force when the beat was scheduled. */
  rhythm: Rhythm;
  kind: BeatKind;
  /** When the R wave falls, ms from the beat's start. Later than R_MS when AV
   *  conduction is slowed (the beat starts with its P wave). */
  rMs: number;
  /** False for a P wave that was not conducted: no QRS, no pulse, no tone. */
  conducted: boolean;
  /** Relative stroke strength for the pleth / arterial pulse, ~0.3–1.1
   *  (0 for a non-conducted beat). */
  pulse: number;
}

export interface BeatClockInput {
  hr: number;
  /** Respiratory rate, breaths/min. 0 = apnea: the breath phase holds. */
  rr: number;
  rhythm: Rhythm;
  /** One PVC per N beats while the rhythm is `pvc`. */
  pvcEveryN: number;
  /** Scenario paused / not started: the clock holds still. */
  frozen: boolean;
}

/** Rhythms with no discrete beats — drawn from absolute time instead. */
const NON_BEATING: ReadonlySet<Rhythm> = new Set(['vfib', 'asystole', 'torsades']);

/** A premature ventricular beat falls early, then a full compensatory pause:
 *  the sinus node is not reset, so the interval spanning the PVC is twice the
 *  sinus cycle (StatPearls, "Premature Ventricular Complex", NBK547713). The coupling
 *  fraction matches a recorded example (coupling 0.52 s, pause 1.13 s — about
 *  0.63 and 1.37 of the cycle): Voss et al., J Physiol 2002;538:271. */
const PVC_COUPLING = 0.6;
const PVC_PAUSE = 2 - PVC_COUPLING;
/** A premature atrial beat enters and resets the sinus node, so its pause is
 *  incomplete — shorter than compensatory (StatPearls NBK559204, NBK547713). */
const PAC_COUPLING = 0.75;
const PAC_PAUSE = 1.1;
const PAC_EVERY_N = 5;
/** AF: irregular R-R intervals with no repeating pattern (January et al.,
 *  2014 AHA/ACC/HRS AF guideline). Each interval is drawn uniformly from this
 *  range (mean 1); the range itself is a drawing choice. */
const AF_MIN = 0.6;
const AF_MAX = 1.4;

/** Sinus rhythm is never metronomic: each interval varies by up to this
 *  fraction either way. Sized so successive intervals differ by about 24 ms
 *  RMS at 72 bpm — the RMSSD reported under propofol anesthesia (24–31 ms;
 *  Lan et al., Sensors 2022;22:9258), below resting norms (42 ± 15 ms;
 *  Shaffer & Ginsberg, Front Public Health 2017;5:258). Too small to see on
 *  the trace; enough that a rate averaged over several beats flickers by a
 *  beat or so. */
const SINUS_JITTER = 0.035;
const SINUS: ReadonlySet<Rhythm> = new Set(['sinus', 'sinus_brady', 'sinus_tach', 'av_block_1']);

// ── AV block (the beat's cycle is the P-P interval; the P wave leads) ────────
/** First-degree block: every P wave conducted, with a constant PR over
 *  200 ms (StatPearls, "First-Degree Heart Block", NBK448164). P peak → R
 *  peak, ms — a PR interval of about 260 ms. */
export const FIRST_DEGREE_PR_MS = 260;
/** Mobitz I (Wenckebach), 4:3 conduction: the PR lengthens beat by beat, by
 *  less each time, until a P wave is not conducted; it is shortest just after
 *  the dropped beat and the R-R interval shortens through the group (Hansom
 *  et al., Curr Cardiol Rev 2021;17:10; Barold, Clin Cardiol 2018;41:282 —
 *  4:3 is the ratio that most often shows the typical pattern). P peak → R
 *  peak for each conducted beat, ms. */
export const WENCKEBACH_PR_MS: readonly number[] = [180, 260, 300];
/** Mobitz II, 3:2 conduction: a constant PR, then a single P wave not
 *  conducted. At least two conducted beats in a row are needed to call it
 *  type II (Barold & Herweg, Front Cardiovasc Med 2024;11:1450705). */
export const MOBITZ2_GROUP = 3;

/** Weak, poorly filled ventricular ectopic: its systolic pressure falls about
 *  20% below the reference beat (Voss et al., J Physiol 2002;538:271), which
 *  at 120/80 leaves roughly 0.4 of the pulse amplitude. The same paper puts
 *  the beat after the pause about 10% above normal in healthy subjects — the
 *  upper clamp on stroke strength below. */
const PVC_PULSE = 0.4;
/** Respiratory swing: pulses are up to this fraction smaller in expiration
 *  than at end-inspiration, where pulse pressure peaks under positive-pressure
 *  ventilation (Michard & Teboul, Crit Care 2000;4:282). 8% is a pulse pressure
 *  variation of about 8% — a volume-replete patient, below the 9–13% grey zone
 *  and the 13% threshold for fluid responsiveness (same paper; Cannesson et
 *  al., Br J Anaesth 2008;101:200, non-responders' pleth variation 8–9%). A
 *  fixed swing: it does not track volume status. */
const RESP_SWING = 0.08;

/** No two breaths are identical: each breath's length varies by up to this
 *  fraction either way. No published breath-to-breath figure was found for
 *  ventilated patients (a ventilator's timing is fixed), so this is kept
 *  small by choice, not by citation… */
const BREATH_JITTER = 0.04;
/** …and its capnogram plateau peaks up to this fraction below the EtCO₂
 *  number (never above it, so the trace stays inside its scale) — a spread
 *  of about 1%, inside the 2.4% median variation of repeated EtCO₂ readings
 *  in stable ventilated patients (Hess & Agarwal, J Clin Monit 1992;8:111).
 *  Enough to look alive, not enough to read as spontaneous breathing. */
const BREATH_HEIGHT_DIP = 0.04;

/** Beats kept: enough for tails that outlast their own cycle (T wave, pulse
 *  wave) and for the heart-rate count, which a bedside monitor averages over
 *  the 12 most recent R-R intervals (Philips IntelliVue MP20–MP90
 *  Instructions for Use, Rel. G.0, Performance Specifications). */
const KEEP_BEATS = 12;
/** The same monitor counts from only the 4 most recent intervals once 3 in a
 *  row exceed 1200 ms, so a slow rate is not averaged over a quarter minute. */
const SLOW_RR_SEC = 1.2;
const SLOW_RATE_BEATS = 4;
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

  private input: BeatClockInput = { hr: 0, rr: 0, rhythm: 'sinus', pvcEveryN: 4, frozen: true };
  /** Position within the current breath, 0..1 (0 = start of expiration). */
  private breath = 0;
  /** The current breath's length as a multiple of 60/RR. */
  private breathFactor = 1;
  /** The current breath's capnogram peak as a fraction of EtCO₂ (≤ 1). */
  breathHeight = 1;
  private readonly breathRand: () => number;
  private readonly rand: () => number;
  private beats: Beat[] = [];
  private nextAt: number | null = null;
  private started = 0;
  /** Clock time of the last conducted R wave (null before the first). */
  private lastRAt: number | null = null;
  private lastMs: number | null = null;

  constructor(seed = 1) {
    this.rand = prng(seed);
    // A separate stream, so breathing never changes which beats are drawn.
    this.breathRand = prng(seed ^ 0x9e3779b9);
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
   * How the rate measured over the recent beats compares with the nominal
   * one: >1 when they came faster than 60/HR, <1 when slower, 1 with no
   * beats. A monitor counts rate from the beats it sees, so its number
   * wanders by a beat or two in sinus rhythm and more in AF — multiply the
   * instructor's HR by this for the displayed value.
   */
  measuredRate(): number {
    const n = this.beats.length;
    if (n === 0) return 1;
    const slow = n >= 3 && this.beats.slice(-3).every((b) => b.rrSec > SLOW_RR_SEC);
    const counted = slow ? this.beats.slice(-SLOW_RATE_BEATS) : this.beats;
    // Only conducted beats are counted, over the time all of them took — so a
    // dropped beat lowers the rate, as it should.
    let sum = 0;
    let qrs = 0;
    for (const b of counted) {
      sum += b.factor;
      if (b.conducted) qrs += 1;
    }
    return qrs / sum;
  }

  /** Breath phase (0..1) at clock time `tSec`, at or shortly before now. */
  breathPhaseAt(tSec: number): number {
    const back = ((this.t - tSec) * (Math.max(0, this.input.rr) / 60)) / this.breathFactor;
    return (((this.breath - back) % 1) + 1) % 1;
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
    this.breath += ((Math.max(0, this.input.rr) / 60) * dtSec) / this.breathFactor;
    if (this.breath >= 1) {
      // A new breath: draw its length and plateau height.
      this.breath %= 1;
      this.breathFactor = 1 + BREATH_JITTER * (2 * this.breathRand() - 1);
      this.breathHeight = 1 - BREATH_HEIGHT_DIP * this.breathRand();
    }

    const { hr, rhythm } = this.input;
    if (NON_BEATING.has(rhythm)) {
      // Fibrillation / standstill: no complexes, and nothing left over from
      // the organized rhythm that preceded it.
      this.beats = [];
      this.nextAt = null;
      this.lastRAt = null;
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
    let rMs = R_MS;
    let conducted = true;

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
    } else if (rhythm === 'av_block_mobitz1') {
      // The cycle is the P-P interval: with one P in every group not
      // conducted, P waves come faster than the ventricular (HR) rate.
      const group = WENCKEBACH_PR_MS.length + 1;
      const pos = index % group;
      factor = (group - 1) / group;
      if (pos === group - 1) conducted = false;
      else rMs = P_MS + WENCKEBACH_PR_MS[pos];
    } else if (rhythm === 'av_block_mobitz2') {
      factor = (MOBITZ2_GROUP - 1) / MOBITZ2_GROUP;
      if (index % MOBITZ2_GROUP === MOBITZ2_GROUP - 1) conducted = false;
    } else if (SINUS.has(rhythm)) {
      factor = 1 + SINUS_JITTER * (2 * this.rand() - 1);
      if (rhythm === 'av_block_1') rMs = P_MS + FIRST_DEGREE_PR_MS;
    }

    let pulse = 0;
    if (conducted) {
      // Stroke strength follows filling time: a beat that comes early after the
      // previous one ejects less, the beat after a pause ejects more, levelling
      // off at long intervals — the relation of stroke volume to the preceding
      // R-R interval in AF (Greenfield et al., J Clin Invest 1968;47:2411;
      // Muntinga et al., Heart 1999;82:575).
      const rAt = at + rMs / 1000;
      const filled = this.lastRAt === null ? 1 : (rAt - this.lastRAt) / base;
      this.lastRAt = rAt;
      const filling = kind === 'pvc' ? PVC_PULSE : clamp(0.4 + 0.6 * filled, 0.5, 1.1);
      // …and swings a little with the breath (largest at end-inspiration,
      // phase 0), unless the patient is apneic.
      const swing =
        this.input.rr > 0 ? (RESP_SWING * (1 - Math.cos(2 * Math.PI * this.breathPhaseAt(at)))) / 2 : 0;
      pulse = filling * (1 - swing);
    }

    const rrSec = factor * base;
    this.beats.push({
      index,
      startSec: at,
      rrSec,
      baseSec: base,
      factor,
      rhythm,
      kind,
      rMs,
      conducted,
      pulse,
    });
    if (this.beats.length > KEEP_BEATS) this.beats.shift();
    this.started += 1;
    return at + rrSec;
  }
}
