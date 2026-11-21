import type { CapnoShape, EcgLead, EcgMorphology, Rhythm } from '@/lib/engine/types';
import { rhythmPerfuses, ST_FIELD } from '@/lib/engine/types';
import { P_MS, R_MS, type Beat } from './beatClock';

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
// A beat's cycle starts a little before its P wave. Conduction times are fixed
// in milliseconds — they do not stretch at slow rates or shrink at fast ones.
// The drawn complex has a PR interval of about 150 ms and a QRS of about
// 95 ms, inside the normal adult ranges (PR 120–200 ms, QRS 60–100 ms;
// StatPearls, "Electrocardiogram", NBK549803). The QT interval follows the
// square root of the cycle length (Bazett: QTc = QT/√RR; Drew et al.,
// Circulation 2010, AHA/ACCF statement on torsade de pointes): about 380 ms
// at 60 bpm, a normal QTc.

/** Beat start → R-wave peak in a normally conducted beat. A beat with slowed
 *  AV conduction carries its own later time in `beat.rMs`; the pulse tone and
 *  the pulse traces are timed from whichever applies. */
export const R_OFFSET_MS = R_MS;
/** R wave → start of the arterial upstroke at a radial line: measured means
 *  174–200 ms, individuals 140–232 ms (Escobar-Restrepo et al., Front Physiol
 *  2018;9:1848). */
export const ART_DELAY_MS = 185;
/** R wave → start of the pleth upstroke at the finger probe: measured means
 *  267–284 ms, individuals 230–330 ms (Kortekaas et al., PLoS One
 *  2018;13:e0204105). */
export const PLETH_DELAY_MS = 270;

const P_BEFORE_R_MS = 150;
/** R → T-wave peak, per √(cycle seconds): 208 ms at 72 bpm. */
const T_AFTER_R_PER_ROOT_SEC = 228;
const T_WIDTH_PER_ROOT_SEC = 63.5;
/** Past this, a beat's complex has fully decayed. */
const BEAT_TAIL_MS = 1100;

/** At standard calibration (10 mm/mV) 1 mm is 0.1 mV (StatPearls NBK549803;
 *  Thygesen et al., Fourth Universal Definition of MI, Eur Heart J 2019). The
 *  R wave here stands 1 mV — 10 mm — tall, so a millimetre is a tenth of the
 *  trace's unit height, and the normal T wave (0.3) is 3 mm, under the 5 mm
 *  limb-lead limit (StatPearls, "ECG T Wave", NBK538264). */
const UNITS_PER_MM = 0.1;

// A wide QRS spreads the same deflections over about 150 ms — past the
// 120 ms that defines a wide complex (complete bundle branch block: Surawicz
// et al., AHA/ACCF/HRS recommendations Part III, 2009) — and everything after
// it (J point, ST segment, T wave) starts later.
const WIDE_QRS_DELAY_MS = 35;
/** A prolonged QT pushes the T wave later and makes it broader: QTc about
 *  515 ms, beyond the 500 ms the AHA/ACCF statement calls highly abnormal
 *  (Drew et al., Circulation 2010; 99th percentile 470 ms men, 480 ms women). */
const LONG_QT_STRETCH = 1.5;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

type BeatShape = Pick<Beat, 'rhythm' | 'kind' | 'baseSec' | 'rrSec'> &
  Partial<Pick<Beat, 'rMs' | 'conducted'>>;

/** Sinus P wave: it opens the beat, at a fixed time from its start. */
function pWave(ms: number): number {
  return gaussian(ms, P_MS, 29, 0.18);
}

/** Depth of the Q and S waves of a normally conducted beat, per lead. */
const Q_S_DEPTH: Record<EcgLead, { q: number; s: number }> = {
  II: { q: -0.22, s: -0.32 },
  // V5: a small septal q (normal there: under 2 mm deep, under 40 ms wide
  // and under a quarter of the R wave), a dominant R, and an s wave that is
  // small or often absent (Meek & Morris, BMJ 2002;324:470; StatPearls,
  // "Electrocardiogram", NBK549803). Drawn 0.8 mm and 1 mm.
  V5: { q: -0.08, s: -0.1 },
};

/** Q, R and S around an R wave at `R` ms. */
function qrs(ms: number, R: number, r: number, lead: EcgLead, wide: boolean): number {
  const { q, s } = Q_S_DEPTH[lead];
  if (wide) {
    return (
      gaussian(ms, R - 38, 16, q) + // Q
      gaussian(ms, R, 22, r) + // broad R
      gaussian(ms, R + 58, 28, s * 1.4) // deep, slurred S
    );
  }
  return (
    gaussian(ms, R - 33, 11, q) + // Q
    gaussian(ms, R, 10, r) + // R
    gaussian(ms, R + 33, 13, s) // S
  );
}

/** R and S only — the AF, SVT and flutter complexes have no Q wave. */
function qrsNoQ(ms: number, R: number, r: number, s: number, sWidthMs: number, wide: boolean): number {
  if (wide) return gaussian(ms, R, 22, r) + gaussian(ms, R + 58, 28, s * 1.4);
  return gaussian(ms, R, 10, r) + gaussian(ms, R + 33, sWidthMs, s);
}

/** T-wave peak time and width for a beat, given the morphology in force. */
function tTiming(R: number, baseSec: number, ecg: EcgMorphology): { peakMs: number; widthMs: number } {
  const root = Math.sqrt(baseSec);
  const stretch = ecg.qt === 'long' ? LONG_QT_STRETCH : 1;
  const delay = ecg.qrs === 'wide' ? WIDE_QRS_DELAY_MS : 0;
  return {
    peakMs: R + delay + T_AFTER_R_PER_ROOT_SEC * root * stretch,
    widthMs: T_WIDTH_PER_ROOT_SEC * root * (ecg.qt === 'long' ? 1.2 : 1),
  };
}

function tWave(ms: number, R: number, baseSec: number, amplitude: number, ecg: EcgMorphology): number {
  const { peakMs, widthMs } = tTiming(R, baseSec, ecg);
  switch (ecg.tWave) {
    case 'peaked':
      // "Tall, narrow, and symmetrical", as in hyperkalemia (StatPearls,
      // "ECG T Wave", NBK538264): 6.6 mm, past the 5 mm limb-lead limit.
      return gaussian(ms, peakMs, widthMs * 0.6, amplitude * 2.2);
    case 'flat':
      // 0.6 mm. No accessible source gave a numeric definition of "flat".
      return gaussian(ms, peakMs, widthMs, amplitude * 0.2);
    case 'inverted':
      // −2.4 mm. Likewise chosen, not cited.
      return gaussian(ms, peakMs, widthMs, -amplitude * 0.8);
    default:
      return gaussian(ms, peakMs, widthMs, amplitude);
  }
}

/**
 * ST-segment offset: the trace sits `stMm` away from baseline from the J
 * point (end of the QRS) through the T wave, which rides on it, and returns
 * to baseline as the T wave ends. Negative = depression. The segment is
 * level, i.e. the horizontal depression that counts as ischemic (≥0.5 mm at
 * the J point: Fourth Universal Definition of MI; ≥1 mm 60–80 ms after it
 * for intraoperative monitoring: London et al., Anesthesiology 1988;69:232).
 */
function stSegment(ms: number, R: number, baseSec: number, ecg: EcgMorphology, stMm: number): number {
  if (stMm === 0) return 0;
  const { peakMs, widthMs } = tTiming(R, baseSec, ecg);
  const jPointMs = R + 50 + (ecg.qrs === 'wide' ? WIDE_QRS_DELAY_MS + 15 : 0);
  const on = sigmoid((ms - jPointMs) / 6);
  const off = 1 - sigmoid((ms - (peakMs + widthMs * 0.9)) / (widthMs * 0.35));
  return stMm * UNITS_PER_MM * on * off;
}

/** A wide ventricular complex with no P wave and a T wave pointing the other
 *  way: the shape of a PVC, and of a ventricular escape or paced beat. */
function wideComplex(ms: number, R: number, height: number): number {
  return gaussian(ms, R, 42, height) + gaussian(ms, R + 84, 58, -0.43 * height);
}

/**
 * Atrial flutter: how many flutter waves per ventricular beat. The atrial
 * rate is typically about 300/min (range 250–350), usually conducted 2:1 for
 * a ventricular rate near 150; 4:1 is also common, 3:1 and 1:1 uncommon
 * (Goodacre & Irons, BMJ 2002;324:594; StatPearls, "Atrial Flutter",
 * NBK540985). So: the first of 2:1, 4:1, 3:1 — then the higher ratios a slow
 * ventricular rate needs, then 1:1 — that puts the atrial rate in range, else
 * whichever comes nearest 300.
 */
export const FLUTTER_ATRIAL_PER_MIN = { min: 250, typical: 300, max: 350 } as const;
export function flutterRatio(baseSec: number): number {
  const ventricularPerMin = 60 / baseSec;
  const candidates = [2, 4, 3, 6, 5, 8, 7, 1];
  const inRange = candidates.find((n) => {
    const atrial = ventricularPerMin * n;
    return atrial >= FLUTTER_ATRIAL_PER_MIN.min && atrial <= FLUTTER_ATRIAL_PER_MIN.max;
  });
  if (inRange) return inRange;
  return candidates.reduce((best, n) =>
    Math.abs(ventricularPerMin * n - FLUTTER_ATRIAL_PER_MIN.typical) <
    Math.abs(ventricularPerMin * best - FLUTTER_ATRIAL_PER_MIN.typical)
      ? n
      : best,
  );
}

/** Sawtooth flutter waves filling the beat — negative-going in lead II, a
 *  slow fall and a quick return, with no flat baseline between them. */
function flutterWaves(ms: number, beat: BeatShape): number {
  const cycleMs = beat.rrSec * 1000;
  if (ms >= cycleMs) return 0;
  const phase = ((ms / cycleMs) * flutterRatio(beat.baseSec)) % 1;
  // Fall over the first 80% of each wave, return over the last 20%.
  const saw = phase < 0.8 ? 0.5 - phase / 0.8 : -0.5 + (phase - 0.8) / 0.2;
  return 0.16 * saw;
}

/** Pacing spike: a very brief vertical deflection just before the paced QRS.
 *  Kept a few milliseconds wide so the renderer's sampling cannot miss it. */
const PACING_SPIKE_BEFORE_R_MS = 70;

/**
 * One beat's contribution to the ECG, `ms` after the beat's start. `ms` may
 * run past the beat's own interval — at fast rates the T wave lands in the
 * next cycle, as it does on a real trace. `ecg` (ST level, T wave, QRS
 * width, QT) reshapes beats with a normal conduction pattern; ectopic, paced
 * and escape wide complexes, VT and PEA keep their own shape. `lead` picks the
 * ST level that lead reads and the normal QRS shape seen from it. The wide
 * and ectopic complexes are drawn alike in both leads — a simplification:
 * their polarity really differs by lead, and no consistent source was found
 * for, e.g., a paced complex in V5.
 */
export function ecgBeat(
  beat: BeatShape,
  ms: number,
  ecg: EcgMorphology = {},
  lead: EcgLead = 'II',
): number {
  if (ms < 0) return 0;

  if (beat.rhythm === 'vtach') {
    // Wide monomorphic complexes with no isoelectric line: one sine-like
    // cycle filling the whole interval.
    const p = ms / (beat.rrSec * 1000);
    if (p >= 1) return 0;
    return 0.9 * Math.sin(p * 2 * Math.PI) * (1 - 0.25 * Math.cos(p * 4 * Math.PI));
  }
  if (ms > BEAT_TAIL_MS) return 0;

  // A P wave that was not conducted: nothing follows it.
  if (beat.conducted === false) return pWave(ms);

  const R = beat.rMs ?? R_OFFSET_MS;

  if (beat.kind === 'pvc') {
    // Wide bizarre complex (over 120 ms), no P, discordant T (StatPearls,
    // "Premature Ventricular Complex", NBK547713).
    return wideComplex(ms, R, 1.15);
  }

  switch (beat.rhythm) {
    case 'pea':
      // Organized-looking wide complexes (no pulse — the pleth goes flat).
      return gaussian(ms, R, 25, 0.55) + gaussian(ms, R + 100, 42, -0.2);
    case 'idioventricular':
      // Ventricular escape: regular wide complexes, P waves absent
      // (StatPearls, "Idioventricular Rhythm", NBK554520).
      return wideComplex(ms, R, 0.9);
    case 'paced':
      // Right-ventricular pacing: a spike, then a wide left-bundle-like QRS
      // with a left superior axis — so mainly negative in lead II — and
      // secondary repolarization changes, drawn as a T wave the other way
      // (Ebrille et al., Indian Pacing Electrophysiol J 2016;16:19; Du &
      // Zhang, BMC Cardiovasc Disord 2022;22:12).
      return gaussian(ms, R - PACING_SPIKE_BEFORE_R_MS, 4, 0.7) + wideComplex(ms, R, -0.9);
    case 'aflutter':
      // Flutter waves in place of P waves and of a flat baseline.
      return flutterWaves(ms, beat) + qrsNoQ(ms, R, 1.0, -0.3, 13, false);
    default:
      break;
  }

  // Mobitz II block is below the AV node, with bundle branch block in most
  // cases, so its conducted beats are wide whatever the QRS setting (Barold &
  // Herweg, Front Cardiovasc Med 2024;11:1450705).
  if (beat.rhythm === 'av_block_mobitz2' && ecg.qrs !== 'wide') ecg = { ...ecg, qrs: 'wide' };
  const wide = ecg.qrs === 'wide';
  const st = stSegment(ms, R, beat.baseSec, ecg, ecg[ST_FIELD[lead]] ?? 0);
  if (beat.kind === 'pac') {
    // Normal QRS behind an early P of different shape (StatPearls,
    // "Premature Atrial Contractions", NBK559204).
    return (
      gaussian(ms, R - 142, 25, 0.12) + qrs(ms, R, 1.0, lead, wide) + tWave(ms, R, beat.baseSec, 0.3, ecg) + st
    );
  }

  switch (beat.rhythm) {
    case 'afib':
      // No P wave (the fibrillatory baseline is added by ecgValue).
      return qrsNoQ(ms, R, 1.0, -0.3, 13, wide) + tWave(ms, R, beat.baseSec, 0.25, ecg) + st;
    case 'svt':
      // Narrow complex, P buried.
      return qrsNoQ(ms, R, 0.9, -0.28, 12, wide) + tWave(ms, R, beat.baseSec, 0.22, ecg) + st;
    case 'junctional':
    case 'av_block_3':
      // Junctional focus: a regular narrow QRS with no P wave ahead of it
      // (StatPearls, "Junctional Rhythm", NBK507715). In complete block this
      // is a junctional escape; set the QRS to wide for a ventricular escape.
      // The dissociated P waves are added by ecgValue.
      return qrs(ms, R, 1.0, lead, wide) + tWave(ms, R, beat.baseSec, 0.3, ecg) + st;
    default:
      // Sinus P-QRS-T (also the normal beats between ectopics, and the
      // conducted beats of first- and second-degree block, where the QRS
      // simply follows its P wave later).
      return pWave(ms) + qrs(ms, R, 1.0, lead, wide) + tWave(ms, R, beat.baseSec, 0.3, ecg) + st;
  }
}

/** Fibrillatory-wave rates, per minute: atrial activity in AF runs at
 *  350–500/min (Kwon & Kim, Korean J Anesthesiol 2017;70:120). */
export const AF_FIB_PER_MIN: readonly number[] = [365, 420, 487];

/** Torsades de pointes: polymorphic VT whose QRS twists about the baseline, at
 *  160–240/min (Drew et al., Circulation 2010; StatPearls, "Torsade de
 *  Pointes", NBK459388). Ventricular rate, and how long one "twist" lasts. */
export const TORSADES_PER_MIN = 220;
const TORSADES_TWIST_SEC = 4.4;

/** Complete heart block: no relation between P waves and QRS complexes; the
 *  atria keep their own regular rate, faster than the ventricles (StatPearls,
 *  "Third-Degree Atrioventricular Block", NBK545199). */
export function dissociatedAtrialPeriodSec(ventricularCycleSec: number): number {
  return Math.min(0.8, ventricularCycleSec * 0.62);
}

/**
 * Rhythm components that don't belong to any one beat; `t` in seconds.
 * `cycleSec` is the current ventricular cycle, where a rhythm needs it.
 */
function ecgBaseline(rhythm: Rhythm, t: number, cycleSec: number): number {
  switch (rhythm) {
    case 'afib': {
      // Fibrillatory baseline: three components beating against each other.
      const [a, b, c] = AF_FIB_PER_MIN.map((perMin) => (perMin / 60) * 2 * Math.PI);
      return 0.04 * Math.sin(t * a) + 0.03 * Math.sin(t * b + 1.3) + 0.02 * Math.sin(t * c + 0.4);
    }
    case 'av_block_3': {
      // P waves marching through at their own rate, unrelated to the QRS.
      const period = dissociatedAtrialPeriodSec(cycleSec);
      const fromPeakMs = ((t % period) - period / 2) * 1000;
      return gaussian(fromPeakMs, 0, 29, 0.18);
    }
    case 'torsades': {
      // Polymorphic VT: fast complexes whose amplitude swells, shrinks and
      // flips, as if twisting about the baseline.
      const beat = Math.sin(t * (TORSADES_PER_MIN / 60) * 2 * Math.PI);
      const twist = Math.sin((t / TORSADES_TWIST_SEC) * 2 * Math.PI);
      return 0.95 * beat * twist + 0.08 * Math.sin(t * 19 + 1);
    }
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

/** Rhythms drawn from the baseline alone: no discrete beats. */
const BASELINE_ONLY: ReadonlySet<Rhythm> = new Set(['vfib', 'asystole', 'torsades']);

/**
 * ECG amplitude at clock time `t` (seconds): the current rhythm's baseline
 * plus every recent beat's complex, drawn with the morphology now in force.
 */
export function ecgValue(
  beats: readonly Beat[],
  rhythm: Rhythm,
  t: number,
  ecg: EcgMorphology = {},
  lead: EcgLead = 'II',
): number {
  const cycleSec = beats.length > 0 ? beats[beats.length - 1].baseSec : 1;
  let v = ecgBaseline(rhythm, t, cycleSec);
  if (BASELINE_ONLY.has(rhythm)) return v;
  for (const b of beats) v += ecgBeat(b, (t - b.startSec) * 1000, ecg, lead);
  return v;
}

/** True for rhythms that can never perfuse. Whether the patient has a pulse
 *  also depends on the `pulseless` flag — use `hasPulse(vitals)` for that. */
export function isPulseless(rhythm: Rhythm): boolean {
  return !rhythmPerfuses(rhythm);
}

/**
 * Systole shortens as the rate rises, and the pulse wave's timings with it.
 * Left ventricular ejection time falls about 0.93 ms per beat/min (LVET =
 * 244 − 0.926·HR + 1.08·SV ms, fitted to Weissler's data: Charlton et al.,
 * Am J Physiol Heart Circ Physiol 2019;317:H1062). Taken here at a stroke
 * volume of 70 mL and expressed relative to 75 bpm, where the wave shapes
 * were drawn.
 */
function pulseScale(baseSec: number): number {
  const lvetMs = (hr: number) => 244 - 0.926 * hr + 1.08 * 70;
  return Math.min(1.3, Math.max(0.6, lvetMs(60 / baseSec) / lvetMs(75)));
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
    if (!b.conducted) continue;
    const ms = (t - b.startSec) * 1000 - b.rMs - delayMs;
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
export function plethValue(beats: readonly Beat[], pulseless: boolean, t: number, spo2: number): number {
  if (pulseless) return 0;
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
  pulseless: boolean,
  t: number,
  sbp: number,
  dbp: number,
): number {
  if (pulseless) return 12; // arrest: near-flat line low on the scale
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
