import type { AlarmState, NibpReading, Rhythm } from '@/lib/engine/types';
import { isPulseless } from './waveforms';

/**
 * What the monitor shows when it has no signal to measure.
 *
 * Display-only: the engine's values and alarm levels are untouched. A scenario
 * in arrest still holds whatever SpO₂ and pressure it was authored with — the
 * monitor simply cannot read them, and says so instead of printing a number.
 */

/** Shown in place of a number the monitor cannot measure. */
export const NO_READING = '--';

/** With no pulse there is nothing for the oximeter to read. */
export function oximeterHasSignal(rhythm: Rhythm): boolean {
  return !isPulseless(rhythm);
}

/** A cuff cycle that found no pressure is a failed reading, not 0/0. */
export function cuffReadingFailed(nibp: NibpReading | null): boolean {
  return nibp !== null && nibp.sbp <= 0;
}

/**
 * Alarm list for the banner: where a tile shows dashes, the alarm names the
 * lost signal instead of quoting the number the tile no longer shows. Levels,
 * order and every other alarm are unchanged.
 */
export function displayAlarms(
  alarms: readonly AlarmState[],
  rhythm: Rhythm,
  nibp: NibpReading | null,
): AlarmState[] {
  const noPulse = !oximeterHasSignal(rhythm);
  const cuffFailed = cuffReadingFailed(nibp);
  return alarms.map((a) => {
    if (a.vital === 'spo2' && noPulse) return { ...a, message: 'SpO₂ NO PULSE' };
    if (a.vital === 'sbp' && cuffFailed) return { ...a, message: 'NIBP NO READING' };
    return a;
  });
}
