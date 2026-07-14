import { describe, expect, it } from 'vitest';

import type { LogEntry, LogKind, VitalsHistorySample } from '../engine/types';
import type { TurningPointInput } from './turningPoints';
import { deriveTurningPoints } from './turningPoints';

const entry = (t: number, kind: LogKind, label: string, detail?: string): LogEntry => ({
  t,
  kind,
  label,
  detail,
});

const sample = (t: number, over: Partial<Omit<VitalsHistorySample, 't'>> = {}): VitalsHistorySample => ({
  t,
  hr: 72,
  sbp: 120,
  dbp: 75,
  spo2: 98,
  etco2: 36,
  rr: 14,
  temp: 36.6,
  ...over,
});

const input = (over: {
  log?: LogEntry[];
  history?: VitalsHistorySample[];
  events?: TurningPointInput['scenario']['events'];
  artLine?: boolean;
}): TurningPointInput => ({
  snapshot: { log: over.log ?? [] },
  scenario: {
    events: over.events ?? [],
    monitoring: over.artLine ? { artLine: true } : undefined,
  },
  history: over.history,
});

describe('deriveTurningPoints', () => {
  it('turns fired events into points, info for resolution and warning otherwise', () => {
    const points = deriveTurningPoints(
      input({
        events: [
          { label: 'Laryngospasm', category: 'airway' },
          { label: 'Spasm breaks', category: 'resolution' },
        ],
        log: [
          entry(30, 'event', 'Laryngospasm', 'automatic'),
          entry(90, 'event', 'Spasm breaks', 'after deepening'),
          entry(120, 'event', 'Improvised bleeding'), // ad-hoc label not in events
        ],
      }),
    );
    expect(points).toEqual([
      { t: 30, kind: 'event', severity: 'warning', label: 'Laryngospasm', detail: 'automatic' },
      { t: 90, kind: 'event', severity: 'info', label: 'Spasm breaks', detail: 'after deepening' },
      { t: 120, kind: 'event', severity: 'warning', label: 'Improvised bleeding', detail: undefined },
    ]);
  });

  it('turns phase changes into info points', () => {
    const points = deriveTurningPoints(input({ log: [entry(60, 'phase', 'Phase: Emergence')] }));
    expect(points).toEqual([
      { t: 60, kind: 'phase', severity: 'info', label: 'Phase: Emergence' },
    ]);
  });

  it('parses rhythm changes from the log, critical for lethal rhythms', () => {
    const points = deriveTurningPoints(
      input({
        log: [
          entry(10, 'vital_change', 'Rhythm → Sinus Tachycardia'),
          entry(50, 'vital_change', 'Rhythm → Ventricular Fibrillation'),
          entry(55, 'vital_change', 'CO₂ waveform → Shark fin'), // not a rhythm line
        ],
      }),
    );
    expect(points).toEqual([
      { t: 10, kind: 'rhythm', severity: 'warning', label: 'Rhythm → Sinus Tachycardia' },
      { t: 50, kind: 'rhythm', severity: 'critical', label: 'Rhythm → Ventricular Fibrillation' },
    ]);
  });

  it('emits alarm points on level escalation, with engine alarm messages', () => {
    const points = deriveTurningPoints(
      input({
        history: [sample(0), sample(10, { spo2: 90 }), sample(20, { spo2: 80 })],
      }),
    );
    expect(points).toEqual([
      { t: 10, kind: 'alarm', severity: 'warning', label: 'SpO₂ low 90' },
      { t: 20, kind: 'alarm', severity: 'critical', label: 'SpO₂ LOW 80' },
    ]);
  });

  it('coalesces threshold flapping within 30 s and re-emits after a real recovery', () => {
    const points = deriveTurningPoints(
      input({
        history: [
          sample(0),
          sample(10, { spo2: 90 }), // emit warning
          sample(20), // silent recovery (10 s after last point)
          sample(25, { spo2: 91 }), // flap back — coalesced, no point
          sample(50), // ≥30 s since last point → recovery emitted
          sample(60, { spo2: 90 }), // fresh excursion after recovery → emits
        ],
      }),
    );
    expect(points).toEqual([
      { t: 10, kind: 'alarm', severity: 'warning', label: 'SpO₂ low 90' },
      { t: 50, kind: 'recovery', severity: 'info', label: 'SpO₂ back in range' },
      { t: 60, kind: 'alarm', severity: 'warning', label: 'SpO₂ low 90' },
    ]);
  });

  it('in cuff mode, BP points come from NIBP log readings, never live history', () => {
    const points = deriveTurningPoints(
      input({
        // Live pressure crashes but the cuff only caught 85/45.
        history: [sample(0), sample(10, { sbp: 60, dbp: 30 })],
        log: [entry(15, 'vital_change', 'NIBP 85/45', 'cuff cycle')],
      }),
    );
    expect(points).toEqual([
      { t: 15, kind: 'alarm', severity: 'warning', label: 'SBP low 85' },
    ]);
  });

  it('in art-line mode, BP points come from live history samples', () => {
    const points = deriveTurningPoints(
      input({
        artLine: true,
        history: [sample(0), sample(10, { sbp: 60, dbp: 30 })],
      }),
    );
    expect(points).toEqual([
      { t: 10, kind: 'alarm', severity: 'critical', label: 'SBP LOW 60' },
    ]);
  });

  it('tolerates a missing history (quota-stripped archives)', () => {
    const points = deriveTurningPoints(
      input({
        log: [
          entry(30, 'event', 'Laryngospasm'),
          entry(45, 'vital_change', 'NIBP 60/40', 'cuff cycle'),
        ],
        events: [{ label: 'Laryngospasm', category: 'airway' }],
      }),
    );
    expect(points).toEqual([
      { t: 30, kind: 'event', severity: 'warning', label: 'Laryngospasm', detail: undefined },
      { t: 45, kind: 'alarm', severity: 'critical', label: 'SBP LOW 60' },
    ]);
  });

  it('returns points sorted by time across sources', () => {
    const points = deriveTurningPoints(
      input({
        log: [entry(100, 'phase', 'Phase: Recovery')],
        history: [sample(0), sample(10, { spo2: 90 })],
      }),
    );
    expect(points.map((p) => p.t)).toEqual([10, 100]);
  });
});
