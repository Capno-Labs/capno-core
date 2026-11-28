import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../engine/engine';
import type { SimSnapshot } from '../engine/types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { DISPLAY_FIELDS, FACULTY_ONLY_FIELDS, toDisplaySnapshot } from './displaySnapshot';

const NOTE = 'Faculty-only remark about a learner';

/** A snapshot with every faculty-side record filled in. */
function busySnapshot(): SimSnapshot {
  const scenario = BUILT_IN_SCENARIOS.find(
    (s) => s.expectedActions.length > 0 && s.events.length > 0,
  );
  if (!scenario) throw new Error('no built-in scenario has both actions and events');
  const engine = new SimulationEngine(scenario, 'TEST');
  engine.setTofAttached(true);
  engine.start();
  engine.triggerEvent(scenario.events[0].id);
  engine.markAction(scenario.expectedActions[0].id, 'done');
  engine.addNote(NOTE);
  engine.tick(1);
  return engine.snapshot();
}

describe('DISPLAY_FIELDS', () => {
  it('is exactly what the monitor draws from', () => {
    // Written out, not derived: taking a field away from displays, or giving
    // them a new one, has to be done here on purpose as well.
    expect([...DISPLAY_FIELDS].sort()).toEqual([
      'alarmLimits',
      'alarms',
      'alarmsOff',
      'alarmsSilenced',
      'elapsedSec',
      'gas',
      'learnerAlarmSetup',
      'nibp',
      'preBrief',
      'status',
      'tof',
      'v5Lead',
      'vitals',
    ]);
  });
});

describe('toDisplaySnapshot', () => {
  it('copies only the listed display fields', () => {
    const display = toDisplaySnapshot(busySnapshot());
    for (const key of Object.keys(display)) {
      expect(DISPLAY_FIELDS as readonly string[]).toContain(key);
    }
  });

  it('carries no faculty-only field, by name or by content', () => {
    const full = busySnapshot();
    const display = toDisplaySnapshot(full);
    for (const field of FACULTY_ONLY_FIELDS) {
      expect(display).not.toHaveProperty(field);
    }
    const wire = JSON.stringify(display);
    expect(wire).not.toContain(NOTE);
    expect(wire).not.toContain(`"${full.scenarioId}"`);
    for (const action of full.actions) expect(wire).not.toContain(`"${action.actionId}"`);
    for (const id of full.firedEventIds) expect(wire).not.toContain(`"${id}"`);
  });

  it('passes each display field through unchanged', () => {
    const full = busySnapshot();
    const display = toDisplaySnapshot(full);
    for (const field of DISPLAY_FIELDS) {
      expect(display[field]).toEqual(full[field]);
    }
    // Not comparing absent with absent: the running fixture fills all but
    // the pre-brief, which exists only before the start (next test).
    const filled = DISPLAY_FIELDS.filter((f) => full[f] !== undefined);
    expect(filled).toEqual(DISPLAY_FIELDS.filter((f) => f !== 'preBrief'));
  });

  it('passes the pre-brief through before the start', () => {
    const scenario = BUILT_IN_SCENARIOS[0];
    const idle = new SimulationEngine(scenario, 'TEST', { preBrief: true }).snapshot();
    expect(idle.preBrief).toBeDefined();
    const display = toDisplaySnapshot(idle);
    expect(display.preBrief).toEqual(idle.preBrief);
    expect(JSON.stringify(display)).not.toContain(`"${scenario.id}"`);
  });

  it('sorts every field of a real snapshot into one list', () => {
    // The typecheck enforces this for the type; this covers the object the
    // engine actually builds.
    const sorted = new Set<string>([...DISPLAY_FIELDS, ...FACULTY_ONLY_FIELDS]);
    for (const key of Object.keys(busySnapshot())) expect(sorted).toContain(key);
    expect(sorted.size).toBe(DISPLAY_FIELDS.length + FACULTY_ONLY_FIELDS.length);
  });

  it('keeps a null cuff reading and leaves absent fields absent', () => {
    const full = { ...busySnapshot(), nibp: null };
    delete full.tof;
    delete full.preBrief;
    const display = toDisplaySnapshot(full);
    expect(display.nibp).toBeNull();
    expect(display).not.toHaveProperty('tof');
    expect(display).not.toHaveProperty('preBrief');
  });

  it('is safe to run twice and survives the wire', () => {
    const once = toDisplaySnapshot(busySnapshot());
    expect(toDisplaySnapshot(once)).toEqual(once);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
  });

  it('does not hand out the session snapshot object itself', () => {
    const full = busySnapshot();
    expect(toDisplaySnapshot(full)).not.toBe(full);
  });
});
