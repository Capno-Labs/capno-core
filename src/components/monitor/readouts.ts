import type { AlarmBand, AlarmParam, AlarmState, NibpReading, Rhythm, TofReading, Vitals } from '@/lib/engine/types';
import { ecgMorphologyApplies, hasPulse } from '@/lib/engine/types';
import { ALARM_SET_KEYS } from '@/lib/engine/vitals';

/**
 * What the monitor shows when it has no signal to measure.
 *
 * Display-only: the engine's values and alarm levels are untouched. A scenario
 * in arrest still holds whatever SpO₂ and pressure it was authored with — the
 * monitor simply cannot read them, and says so instead of printing a number.
 */

/** Shown in place of a number the monitor cannot measure. */
export const NO_READING = '--';

/** Pulse oximetry depends on a pulsatile arterial signal (Jubran, Crit Care
 *  1999;3:R11); with no pulse a monitor replaces the number with a
 *  no-reading mark and a technical alarm, not a value. That is so whether the
 *  rhythm cannot perfuse (VF) or an organized one simply has no pulse (PEA). */
export function oximeterHasSignal(vitals: Pick<Vitals, 'rhythm' | 'pulseless'>): boolean {
  return hasPulse(vitals);
}

/** Whether an ST level means anything in this rhythm (not in VT, VF, PEA or asystole). */
export function stIsMeasurable(rhythm: Rhythm): boolean {
  return ecgMorphologyApplies(rhythm);
}

/** Lowest systolic pressure an oscillometric cuff can report, mmHg: the adult
 *  measurement range starts at 30 systolic, and below it — or with no regular
 *  pulse — the measurement fails (Philips IntelliVue MP20–MP90 Instructions
 *  for Use, Rel. G.0: NBP range and "NBP MEASURE FAILED"). */
export const NIBP_MIN_SYSTOLIC = 30;

/** A cuff cycle below the measurable range is a failed reading, not a number. */
export function cuffReadingFailed(nibp: NibpReading | null): boolean {
  return nibp !== null && nibp.sbp < NIBP_MIN_SYSTOLIC;
}

/**
 * A silenced alarm normally stays on screen, ticked, while its cause lasts —
 * "except for NBP alarms and alarms from other intermittent measurements.
 * When such an alarm is acknowledged the alarm message disappears" (Philips
 * IntelliVue MX750/MX850 Instructions for Use, "Acknowledging Alarms"). The
 * next cuff reading alarms afresh if it is still out of range.
 */
export function alarmDismissed(alarm: AlarmState, nibp: NibpReading | null): boolean {
  return alarm.acknowledged === true && alarm.vital === 'sbp' && nibp !== null;
}

/**
 * Alarm list for the banner: where a tile shows dashes, the alarm names the
 * lost signal instead of quoting the number the tile no longer shows. Levels,
 * order and every other alarm are unchanged.
 */
export function displayAlarms(
  alarms: readonly AlarmState[],
  vitals: Pick<Vitals, 'rhythm' | 'pulseless'>,
  nibp: NibpReading | null,
): AlarmState[] {
  const noPulse = !oximeterHasSignal(vitals);
  const cuffFailed = cuffReadingFailed(nibp);
  return alarms.filter((a) => !alarmDismissed(a, nibp)).map((a) => {
    if (a.vital === 'spo2' && noPulse) return { ...a, message: 'SpO₂ NO PULSE' };
    if (a.vital === 'sbp' && cuffFailed) return { ...a, message: 'NIBP NO READING' };
    return a;
  });
}

/** Milliseconds between the four stimuli of a train: 2 Hz (Thilen et al.,
 *  Anesthesiology 2023;138:13 — "four brief electrical pulses … at the rate
 *  of 2 Hz"). The tile's bars appear at this spacing after each measurement. */
export const TOF_PULSE_INTERVAL_MS = 500;

/**
 * Heights of the four twitch bars, 0–1, relative to the first twitch of the
 * same train — the sim holds no pre-relaxant reference, so it cannot draw the
 * first twitch itself as depressed (and so cannot show a depolarising block,
 * where all four fall together).
 *
 * Fade runs down the train: "the progressive disappearance of the fourth,
 * then the third, then the second, and finally the first twitch" (Thilen
 * 2023), which a monitor shows as "a slope in the bar graph" (GE HealthCare,
 * NMT quick guide JB16515XX). No source gives the second and third twitches
 * as a function of the ratio, so the even slope is a drawing choice: with
 * four twitches it runs from the first down to the ratio; with fewer, from
 * the first down to nothing at the first absent twitch — which is also where
 * four twitches at a ratio of 0 would sit, so nothing jumps as the fourth
 * returns.
 */
export function twitchHeights(reading: Pick<TofReading, 'count' | 'ratio'>): [number, number, number, number] {
  const heights: [number, number, number, number] = [0, 0, 0, 0];
  const count = Math.min(4, Math.max(0, Math.round(reading.count)));
  if (count === 0) return heights;
  const last = count === 4 ? Math.min(1, Math.max(0, (reading.ratio ?? 100) / 100)) : 0;
  const span = count === 4 ? 3 : count;
  for (let i = 0; i < count; i++) heights[i] = 1 - ((1 - last) * i) / span;
  return heights;
}

/**
 * Alarm limits as a monitor prints them beside the number: the low and high
 * limit the clinician sets ("50–110"), or the one that exists ("min 92").
 * Empty when there is neither. For a vital those are the warning limits — the
 * critical tier is not printed, since a monitor shows the limits the
 * clinician sets, not its extreme alarms. A machine reading has one limit a
 * side, named by `param`.
 */
export function limitsText(band: AlarmBand | undefined, param?: AlarmParam): string | undefined {
  if (!band) return undefined;
  const keys = param ? ALARM_SET_KEYS[param] : { low: 'warnLow' as const, high: 'warnHigh' as const };
  const low = keys.low ? band[keys.low] : undefined;
  const high = keys.high ? band[keys.high] : undefined;
  if (low !== undefined && high !== undefined) return `${low}–${high}`;
  if (low !== undefined) return `min ${low}`;
  if (high !== undefined) return `max ${high}`;
  return undefined;
}
