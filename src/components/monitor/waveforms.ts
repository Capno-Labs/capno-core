import type { CapnoShape, Rhythm } from '@/lib/engine/types';

/**
 * Synthetic waveform generators for the student monitor.
 *
 * These are display placeholders, not physiologic models: each returns a
 * normalized amplitude (-1..1) for a phase position within one cycle
 * (0..1 = one beat or one breath). The canvas renderer advances phase using
 * the live HR/RR, so rate changes from the faculty controller are reflected
 * immediately in the trace.
 */

function gaussian(x: number, center: number, width: number, amplitude: number): number {
  const d = (x - center) / width;
  return amplitude * Math.exp(-d * d);
}

/** One cycle of a synthetic sinus ECG complex (P-QRS-T). */
function sinusComplex(p: number): number {
  return (
    gaussian(p, 0.12, 0.035, 0.18) + // P
    gaussian(p, 0.26, 0.014, -0.22) + // Q
    gaussian(p, 0.3, 0.012, 1.0) + // R
    gaussian(p, 0.34, 0.016, -0.32) + // S
    gaussian(p, 0.55, 0.07, 0.3) // T
  );
}

/**
 * ECG amplitude at phase p (0..1 within the current beat).
 * `t` is absolute time in seconds, used for non-periodic rhythms (vfib noise).
 * `beat` counts completed cycles, used by ectopy rhythms (pvc/pac) to swap
 * every Nth complex for an ectopic one. `pvcEveryN` is the PVC coupling
 * rate (one ectopic per N beats — see PVC_FREQUENCY_EVERY_N).
 */
export function ecgSample(rhythm: Rhythm, p: number, t: number, beat = 0, pvcEveryN = 4): number {
  switch (rhythm) {
    case 'sinus':
    case 'sinus_brady':
    case 'sinus_tach':
      return sinusComplex(p);
    case 'pvc':
      // Every Nth beat: early wide bizarre complex (no P, discordant T),
      // then a flat tail that reads as the compensatory pause.
      if (beat % pvcEveryN === pvcEveryN - 1) {
        return gaussian(p, 0.1, 0.05, 1.15) + gaussian(p, 0.2, 0.07, -0.5);
      }
      return sinusComplex(p);
    case 'pac':
      // Every 5th beat: early narrow complex with an abnormal P, then a
      // flat tail (post-extrasystolic pause).
      if (beat % 5 === 4) {
        return (
          gaussian(p, 0.03, 0.03, 0.12) + // ectopic P, different axis
          gaussian(p, 0.16, 0.014, -0.22) +
          gaussian(p, 0.2, 0.012, 1.0) +
          gaussian(p, 0.24, 0.016, -0.32) +
          gaussian(p, 0.45, 0.07, 0.3)
        );
      }
      return sinusComplex(p);
    case 'afib': {
      // No P wave; fibrillatory baseline + normal QRS.
      const fib =
        0.04 * Math.sin(t * 44) + 0.03 * Math.sin(t * 71 + 1.3) + 0.02 * Math.sin(t * 103 + 0.4);
      return fib + gaussian(p, 0.3, 0.012, 1.0) + gaussian(p, 0.34, 0.016, -0.3) + gaussian(p, 0.55, 0.07, 0.25);
    }
    case 'svt':
      // Narrow complex, P buried.
      return gaussian(p, 0.3, 0.012, 0.9) + gaussian(p, 0.34, 0.014, -0.28) + gaussian(p, 0.52, 0.06, 0.22);
    case 'vtach':
      // Wide monomorphic complexes ~ sine-like.
      return 0.9 * Math.sin(p * 2 * Math.PI) * (1 - 0.25 * Math.cos(p * 4 * Math.PI));
    case 'vfib':
      // Chaotic — irregular sum of sines, independent of beat phase.
      return (
        0.45 * Math.sin(t * 31 + Math.sin(t * 3.7) * 4) +
        0.3 * Math.sin(t * 47 + 1.7) +
        0.2 * Math.sin(t * 19 + Math.sin(t * 5.1) * 2)
      );
    case 'pea':
      // Organized-looking slow wide complexes (no pulse — pleth goes flat).
      return gaussian(p, 0.3, 0.03, 0.55) + gaussian(p, 0.42, 0.05, -0.2);
    case 'asystole':
      return 0.015 * Math.sin(t * 1.1); // near-flat with drift
  }
}

const PULSELESS: ReadonlySet<Rhythm> = new Set(['vfib', 'pea', 'asystole']);

export function isPulseless(rhythm: Rhythm): boolean {
  return PULSELESS.has(rhythm);
}

/** Plethysmograph (SpO2) waveform: systolic upstroke + dicrotic notch. */
export function plethSample(rhythm: Rhythm, p: number, spo2: number): number {
  if (isPulseless(rhythm)) return 0;
  const upstroke = gaussian(p, 0.18, 0.09, 1.0);
  const dicrotic = gaussian(p, 0.45, 0.09, 0.35);
  // Degrade amplitude as saturation falls (poor perfusion look).
  const amplitude = spo2 >= 90 ? 1 : Math.max(0.25, spo2 / 100);
  return (upstroke + dicrotic - 0.25) * amplitude;
}

/**
 * Arterial pressure waveform, in mmHg: rapid systolic upstroke, dicrotic
 * notch, diastolic runoff. Unlike the normalized traces, this returns an
 * absolute pressure — the renderer draws it on a fixed 0–170 mmHg scale so
 * hypotension visibly lowers and flattens the trace (the teaching point).
 */
export function artSample(rhythm: Rhythm, p: number, sbp: number, dbp: number): number {
  if (isPulseless(rhythm)) return 12; // arrest: near-flat line low on the scale
  const pulse = Math.max(0, sbp - dbp);
  const shape =
    gaussian(p, 0.16, 0.08, 1.0) + // systolic peak
    gaussian(p, 0.44, 0.1, 0.38); // dicrotic bump after the notch
  return dbp + pulse * Math.min(1, shape);
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
