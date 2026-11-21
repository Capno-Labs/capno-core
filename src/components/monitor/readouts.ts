import type { AlarmState, NibpReading, Rhythm, Vitals } from '@/lib/engine/types';
import { ecgMorphologyApplies, hasPulse } from '@/lib/engine/types';

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
  return alarms.map((a) => {
    if (a.vital === 'spo2' && noPulse) return { ...a, message: 'SpO₂ NO PULSE' };
    if (a.vital === 'sbp' && cuffFailed) return { ...a, message: 'NIBP NO READING' };
    return a;
  });
}
