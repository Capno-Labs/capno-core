import { describe, expect, it } from 'vitest';
import type { AlarmState } from '@/lib/engine/types';
import { cuffReadingFailed, displayAlarms, oximeterHasSignal } from './readouts';

const alarm = (vital: AlarmState['vital'], message: string, level: AlarmState['level'] = 'critical'): AlarmState => ({
  vital,
  level,
  message,
});

describe('lost-signal readouts', () => {
  it('loses the oximeter signal only in pulseless rhythms', () => {
    for (const rhythm of ['vfib', 'pea', 'asystole'] as const) expect(oximeterHasSignal(rhythm)).toBe(false);
    for (const rhythm of ['sinus', 'afib', 'pvc', 'svt', 'vtach'] as const) {
      expect(oximeterHasSignal(rhythm)).toBe(true);
    }
  });

  it('treats a cuff cycle with no pressure as a failed reading', () => {
    expect(cuffReadingFailed({ sbp: 0, dbp: 0, atSec: 60 })).toBe(true);
    expect(cuffReadingFailed({ sbp: 62, dbp: 34, atSec: 60 })).toBe(false);
    expect(cuffReadingFailed(null)).toBe(false); // arterial line: no cuff at all
  });

  it('names the lost signal in the banner and leaves everything else alone', () => {
    const alarms = [
      alarm('rhythm', 'RHYTHM: VFIB'),
      alarm('spo2', 'SpO₂ LOW 0'),
      alarm('sbp', 'SBP LOW 0'),
      alarm('etco2', 'EtCO₂ LOW 10'),
    ];
    const shown = displayAlarms(alarms, 'vfib', { sbp: 0, dbp: 0, atSec: 60 });
    expect(shown.map((a) => a.message)).toEqual([
      'RHYTHM: VFIB',
      'SpO₂ NO PULSE',
      'NIBP NO READING',
      'EtCO₂ LOW 10',
    ]);
    expect(shown.map((a) => a.level)).toEqual(alarms.map((a) => a.level));
    expect(shown.map((a) => a.vital)).toEqual(alarms.map((a) => a.vital));
    // The engine's alarm objects are not mutated.
    expect(alarms[1].message).toBe('SpO₂ LOW 0');
  });

  it('quotes the numbers as usual while there is a signal', () => {
    const alarms = [alarm('spo2', 'SpO₂ LOW 84'), alarm('sbp', 'SBP LOW 62')];
    expect(displayAlarms(alarms, 'sinus_tach', { sbp: 62, dbp: 34, atSec: 60 })).toEqual(alarms);
    // Arterial line in a perfusing rhythm: nothing to relabel either.
    expect(displayAlarms(alarms, 'afib', null)).toEqual(alarms);
  });

  it('keeps a low arterial-line pressure as a number even in arrest', () => {
    const alarms = [alarm('sbp', 'SBP LOW 0')];
    expect(displayAlarms(alarms, 'asystole', null)).toEqual(alarms);
  });
});
