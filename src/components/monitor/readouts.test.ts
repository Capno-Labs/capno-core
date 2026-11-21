import { describe, expect, it } from 'vitest';
import type { AlarmState } from '@/lib/engine/types';
import { formatStMm } from '@/lib/engine/types';
import { cuffReadingFailed, displayAlarms, oximeterHasSignal, stIsMeasurable } from './readouts';

const alarm = (vital: AlarmState['vital'], message: string, level: AlarmState['level'] = 'critical'): AlarmState => ({
  vital,
  level,
  message,
});

describe('lost-signal readouts', () => {
  it('loses the oximeter signal whenever there is no pulse', () => {
    for (const rhythm of ['vfib', 'pea', 'asystole', 'torsades'] as const) {
      expect(oximeterHasSignal({ rhythm })).toBe(false);
    }
    for (const rhythm of ['sinus', 'afib', 'pvc', 'svt', 'vtach', 'paced', 'av_block_3'] as const) {
      expect(oximeterHasSignal({ rhythm })).toBe(true);
      // PEA / pulseless VT: an organized rhythm with the pulse taken away.
      expect(oximeterHasSignal({ rhythm, pulseless: true })).toBe(false);
    }
  });

  it('treats a cuff cycle below the measurable range as a failed reading', () => {
    expect(cuffReadingFailed({ sbp: 0, dbp: 0, atSec: 60 })).toBe(true);
    // The oscillometric range starts at 30 mmHg systolic.
    expect(cuffReadingFailed({ sbp: 29, dbp: 9, atSec: 60 })).toBe(true);
    expect(cuffReadingFailed({ sbp: 30, dbp: 10, atSec: 60 })).toBe(false);
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
    const shown = displayAlarms(alarms, { rhythm: 'vfib' }, { sbp: 0, dbp: 0, atSec: 60 });
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
    expect(displayAlarms(alarms, { rhythm: 'sinus_tach' }, { sbp: 62, dbp: 34, atSec: 60 })).toEqual(alarms);
    // Arterial line in a perfusing rhythm: nothing to relabel either.
    expect(displayAlarms(alarms, { rhythm: 'afib' }, null)).toEqual(alarms);
  });

  it('keeps a low arterial-line pressure as a number even in arrest', () => {
    const alarms = [alarm('sbp', 'SBP LOW 0')];
    expect(displayAlarms(alarms, { rhythm: 'asystole' }, null)).toEqual(alarms);
  });

  it('reads an ST level only where there are complexes to measure it on', () => {
    for (const rhythm of ['sinus', 'sinus_brady', 'sinus_tach', 'pvc', 'pac', 'afib', 'svt'] as const) {
      expect(stIsMeasurable(rhythm)).toBe(true);
    }
    for (const rhythm of ['vtach', 'vfib', 'pea', 'asystole'] as const) {
      expect(stIsMeasurable(rhythm)).toBe(false);
    }
  });

  it('prints the ST level signed, to one decimal', () => {
    expect(formatStMm(0)).toBe('0.0');
    expect(formatStMm(-2)).toBe('−2.0');
    expect(formatStMm(1.5)).toBe('+1.5');
    expect(formatStMm(-0.04)).toBe('0.0'); // no "−0.0" while ramping through zero
    expect(formatStMm(0.26)).toBe('+0.3');
  });
});

