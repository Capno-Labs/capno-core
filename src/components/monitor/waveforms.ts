import type { CapnoShape, Rhythm } from '@/lib/engine/types';
import type { Beat } from './beatClock';

/**
 * Synthetic waveform generators for the student monitor.
 *
 * These are display placeholders, not physiologic models. The cardiac traces
 * (ECG, pleth, arterial line) are built from the beats of one shared
 * `BeatClock`, so they stay locked to each other and to the pulse tone; each
 * beat contributes a complex timed in milliseconds from its start. The
 * capnogram is separate: it returns a normalized amplitude for a phase
 * position within one breath.
 */

function gaussian(x: number, center: number, width: number, amplitude: number): number {
  const d = (x - center) / width;
  return amplitude * Math.exp(-d * d);
}

/**
 * Longest step between plotted samples, in seconds. The R wave is only about
 * 20 ms wide, so sampling once per animation frame (16–33 ms) drew it at a
 * different height on every beat — or skipped it. The renderer sub-steps each
 * frame at this interval instead.
 */
export const SUBSTEP_SEC = 0.004;

// ── Cardiac timing (milliseconds) ────────────────────────────────────────────
// A beat's cycle starts a little before its P wave. Conduction times (P–R, QRS
// width) are fixed in milliseconds — they do not stretch at slow rates or
// shrink at fast ones, which a phase-based template did. Repolarization and
// the pulse wave shorten with rate, scaled by the square root of the cycle
// length. Values are carried over from the previous 72 bpm phase template.

/** Beat start → R-wave peak. The pulse tone fires here. */
export const R_OFFSET_MS = 210;
/** R wave → start of the arterial upstroke at the transducer. */
export const ART_DELAY_MS = 160;
/** R wave → start of the pleth upstroke at the finger probe. */
export const PLETH_DELAY_MS = 250;

const P_BEFORE_R_MS = 150;
/** R → T-wave peak, per √(cycle seconds): 208 ms at 72 bpm. */
const T_AFTER_R_PER_ROOT_SEC = 228;
const T_WIDTH_PER_ROOT_SEC = 63.5;
/** Past this, a beat's complex has fully decayed. */
const BEAT_TAIL_MS = 950;

function qrs(ms: number, r: number, s: number): number {
  return (
    gaussian(ms, R_OFFSET_MS - 33, 11, -0.22) + // Q
    gaussian(ms, R_OFFSET_MS, 10, r) + // R
    gaussian(ms, R_OFFSET_MS + 33, 13, s) // S
  );
}

function tWave(ms: number, baseSec: number, amplitude: number): number {
  const root = Math.sqrt(baseSec);
  return gaussian(ms, R_OFFSET_MS + T_AFTER_R_PER_ROOT_SEC * root, T_WIDTH_PER_ROOT_SEC * root, amplitude);
}

/**
 * One beat's contribution to the ECG, `ms` after the beat's start. `ms` may
 * run past the beat's own interval — at fast rates the T wave lands in the
 * next cycle, as it does on a real trace.
 */
export function ecgBeat(beat: Pick<Beat, 'rhythm' | 'kind' | 'baseSec' | 'rrSec'>, ms: number): number {
  if (ms < 0) return 0;

  if (beat.rhythm === 'vtach') {
    // Wide monomorphic complexes with no isoelectric line: one sine-like
    // cycle filling the whole interval.
    const p = ms / (beat.rrSec * 1000);
    if (p >= 1) return 0;
    return 0.9 * Math.sin(p * 2 * Math.PI) * (1 - 0.25 * Math.cos(p * 4 * Math.PI));
  }
  if (ms > BEAT_TAIL_MS) return 0;

  if (beat.kind === 'pvc') {
    // Wide bizarre complex, no P, discordant T.
    return gaussian(ms, R_OFFSET_MS, 42, 1.15) + gaussian(ms, R_OFFSET_MS + 84, 58, -0.5);
  }
  if (beat.kind === 'pac') {
    // Narrow complex behind an ectopic P of different shape.
    return (
      gaussian(ms, R_OFFSET_MS - 142, 25, 0.12) + qrs(ms, 1.0, -0.32) + tWave(ms, beat.baseSec, 0.3)
    );
  }

  switch (beat.rhythm) {
    case 'afib':
      // No P wave (the fibrillatory baseline is added by ecgValue).
      return gaussian(ms, R_OFFSET_MS, 10, 1.0) + gaussian(ms, R_OFFSET_MS + 33, 13, -0.3) + tWave(ms, beat.baseSec, 0.25);
    case 'svt':
      // Narrow complex, P buried.
      return gaussian(ms, R_OFFSET_MS, 10, 0.9) + gaussian(ms, R_OFFSET_MS + 33, 12, -0.28) + tWave(ms, beat.baseSec, 0.22);
    case 'pea':
      // Organized-looking wide complexes (no pulse — the pleth goes flat).
      return gaussian(ms, R_OFFSET_MS, 25, 0.55) + gaussian(ms, R_OFFSET_MS + 100, 42, -0.2);
    default:
      // Sinus P-QRS-T (also the normal beats between ectopics).
      return (
        gaussian(ms, R_OFFSET_MS - P_BEFORE_R_MS, 29, 0.18) + qrs(ms, 1.0, -0.32) + tWave(ms, beat.baseSec, 0.3)
      );
  }
}

/** Rhythm components that don't belong to any one beat; `t` in seconds. */
function ecgBaseline(rhythm: Rhythm, t: number): number {
  switch (rhythm) {
    case 'afib':
      // Fibrillatory baseline.
      return 0.04 * Math.sin(t * 44) + 0.03 * Math.sin(t * 71 + 1.3) + 0.02 * Math.sin(t * 103 + 0.4);
    case 'vfib':
      // Chaotic — irregular sum of sines.
      return (
        0.45 * Math.sin(t * 31 + Math.sin(t * 3.7) * 4) +
        0.3 * Math.sin(t * 47 + 1.7) +
        0.2 * Math.sin(t * 19 + Math.sin(t * 5.1) * 2)
      );
    case 'asystole':
      return 0.015 * Math.sin(t * 1.1); // near-flat with drift
    default:
      return 0;
  }
}

/**
 * ECG amplitude at clock time `t` (seconds): the current rhythm's baseline
 * plus every recent beat's complex.
 */
export function ecgValue(beats: readonly Beat[], rhythm: Rhythm, t: number): number {
  let v = ecgBaseline(rhythm, t);
  if (rhythm === 'vfib' || rhythm === 'asystole') return v;
  for (const b of beats) v += ecgBeat(b, (t - b.startSec) * 1000);
  return v;
}

const PULSELESS: ReadonlySet<Rhythm> = new Set(['vfib', 'pea', 'asystole']);

export function isPulseless(rhythm: Rhythm): boolean {
  return PULSELESS.has(rhythm);
}

/** Systole shortens with rate; the pulse wave's timings scale with it. */
function pulseScale(baseSec: number): number {
  return Math.min(1.5, Math.max(0.6, Math.sqrt(baseSec / 0.8)));
}

/** Summed pulse waves of the recent beats, each weighted by its stroke strength. */
function pulseSum(
  beats: readonly Beat[],
  t: number,
  delayMs: number,
  wave: (ms: number, scale: number) => number,
): number {
  let sum = 0;
  for (const b of beats) {
    const ms = (t - b.startSec) * 1000 - R_OFFSET_MS - delayMs;
    if (ms < -250 || ms > 1500) continue;
    sum += b.pulse * wave(ms, pulseScale(b.baseSec));
  }
  return sum;
}

/** Pleth pulse: systolic upstroke + dicrotic wave, `ms` after its onset. */
function plethWave(ms: number, k: number): number {
  return gaussian(ms, 150 * k, 75 * k, 1.0) + gaussian(ms, 375 * k, 75 * k, 0.35);
}

/** Arterial pulse: rapid systolic peak, then the dicrotic bump after the notch. */
function artWave(ms: number, k: number): number {
  return gaussian(ms, 133 * k, 67 * k, 1.0) + gaussian(ms, 367 * k, 83 * k, 0.38);
}

/**
 * Plethysmograph (SpO2) at clock time `t`: each beat's pulse arrives a fixed
 * delay after its R wave, and a weak beat (a PVC, a short AF cycle) draws a
 * small one.
 */
export function plethValue(beats: readonly Beat[], rhythm: Rhythm, t: number, spo2: number): number {
  if (isPulseless(rhythm)) return 0;
  // Degrade amplitude as saturation falls (poor perfusion look).
  const amplitude = spo2 >= 90 ? 1 : Math.max(0.25, spo2 / 100);
  return (Math.min(1.1, pulseSum(beats, t, PLETH_DELAY_MS, plethWave)) - 0.25) * amplitude;
}

/**
 * Arterial pressure at clock time `t`, in mmHg. Unlike the normalized traces,
 * this returns an absolute pressure — the renderer draws it on a fixed
 * 0–170 mmHg scale so hypotension visibly lowers and flattens the trace (the
 * teaching point). Weak beats peak below the systolic number.
 */
export function artValue(
  beats: readonly Beat[],
  rhythm: Rhythm,
  t: number,
  sbp: number,
  dbp: number,
): number {
  if (isPulseless(rhythm)) return 12; // arrest: near-flat line low on the scale
  const pulse = Math.max(0, sbp - dbp);
  return dbp + pulse * Math.min(1, pulseSum(beats, t, ART_DELAY_MS, artWave));
}

/**
 * Capnograph: square-ish expiratory plateau. p is 0..1 within one breath.
 * Returns 0..1 (scaled by EtCO2 by the renderer).
 */
export function capnoSample(
  p: number,
  rr: number,
  etco2: number,
  shape: CapnoShape = 'normal',
): number {
  if (rr <= 0 || etco2 <= 0) return 0;
  // Expiration occupies ~55% of the cycle, ending at the end-tidal peak
  // (exactly 1 so the renderer's EtCO2 scaling is exact and the trace never
  // clips the canvas top), then a sharp inspiratory downstroke to baseline.
  const plateauEnd = 0.55;
  // The up/downstrokes take a fixed fraction of a second on a real
  // capnograph, independent of rate. Sizing them as a fraction of the breath
  // made slow rates draw gradual ramps instead of near-vertical edges, so
  // convert fixed durations to phase fractions (capped for very fast rates).
  const breathSec = 60 / rr;
  const riseFrac = Math.min(0.15 / breathSec, 0.08);
  const fallFrac = Math.min(0.1 / breathSec, 0.05);
  const fallEnd = plateauEnd + fallFrac;
  if (p >= fallEnd) return 0;
  if (p >= plateauEnd) return Math.max(0, 1 - (p - plateauEnd) / fallFrac);

  if (shape === 'bronchospasm') {
    // "Shark fin": obstructed expiration slurs the upstroke into the plateau —
    // one continuous curved rise to the end-tidal peak, no flat top.
    const k = 2.2; // curvature; higher = steeper initial rise, flatter top
    const x = p / plateauEnd;
    return (1 - Math.exp(-k * x)) / (1 - Math.exp(-k));
  }

  // Normal: rapid rise, then an alveolar plateau sloping up to the peak.
  const plateauStart = 0.94;
  const base =
    p < riseFrac
      ? plateauStart * (p / riseFrac)
      : plateauStart + (1 - plateauStart) * ((p - riseFrac) / (plateauEnd - riseFrac));

  if (shape === 'curare_cleft') {
    // Curare cleft: a transient notch in an otherwise normal plateau —
    // a spontaneous inspiratory effort during partial neuromuscular
    // blockade. The dip sits mid-plateau and dies out well before the
    // end-tidal peak, so the peak stays exactly 1 for EtCO2 scaling.
    return Math.max(0, base - gaussian(p, 0.33, 0.045, 0.35));
  }

  return base;
}
