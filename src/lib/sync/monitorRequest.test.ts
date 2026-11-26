import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../engine/engine';
import { ALARM_PROFILES } from '../engine/vitals';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { applyMonitorRequest, createRequestGate, monitorRequestSchema, newRequestId } from './monitorRequest';

const session = () => {
  const e = new SimulationEngine(BUILT_IN_SCENARIOS[0], 'TEST');
  e.start();
  return e;
};

describe('requests from a student display', () => {
  it('steps an alarm limit one press at a time, relative to where the session has it', () => {
    const e = session();
    const press = { kind: 'alarmLimitStep', vital: 'hr', side: 'high', direction: 1 };
    // Two presses sent before any snapshot came back: both count.
    expect(applyMonitorRequest(e, press)).toBe(true);
    expect(applyMonitorRequest(e, press)).toBe(true);
    expect(e.snapshot().alarmLimits!.hr.warnHigh).toBe(ALARM_PROFILES.adult.hr.warnHigh! + 10);
    applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'hr', side: 'low', direction: -1 });
    expect(e.snapshot().alarmLimits!.hr.warnLow).toBe(ALARM_PROFILES.adult.hr.warnLow! - 5);
  });

  it('switches one vital\'s alarms off and on', () => {
    const e = session();
    expect(applyMonitorRequest(e, { kind: 'alarmOff', vital: 'spo2', off: true })).toBe(true);
    expect(e.snapshot().alarmsOff).toEqual(['spo2']);
    applyMonitorRequest(e, { kind: 'alarmOff', vital: 'spo2', off: false });
    expect(e.snapshot().alarmsOff).toEqual([]);
  });

  it('logs the change as the learner\'s', () => {
    const e = session();
    applyMonitorRequest(e, { kind: 'alarmOff', vital: 'spo2', off: true });
    expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'SpO₂ alarms off', detail: 'on a student display' });
    // The same change made at the controller carries no such note.
    e.setAlarmOff('hr', true);
    expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'HR alarms off', detail: undefined });
  });

  it('drops everything while faculty have learner alarm setup switched off', () => {
    const e = session();
    e.setLearnerAlarmSetup(false);
    expect(e.snapshot().learnerAlarmSetup).toBe(false);
    expect(applyMonitorRequest(e, { kind: 'alarmOff', vital: 'spo2', off: true })).toBe(false);
    expect(applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'hr', side: 'high', direction: 1 })).toBe(false);
    expect(e.snapshot().alarmsOff).toEqual([]);
    expect(e.snapshot().alarmLimits).toEqual(ALARM_PROFILES.adult);
  });

  it('drops anything that is not exactly a known request', () => {
    const e = session();
    const before = JSON.stringify({ ...e.snapshot(), log: [] });
    const junk: unknown[] = [
      null,
      undefined,
      'alarmOff',
      42,
      {},
      { kind: 'alarmOff' },
      { kind: 'alarmOff', vital: 'pplat', off: true }, // not a reading with limit alarms
      { kind: 'alarmOff', vital: 'vt', off: true }, // the limit is on minute volume: 'mv'
      { kind: 'alarmOff', vital: 'spo2', off: 'yes' },
      { kind: 'alarmOff', vital: 'spo2', off: true, extra: 1 },
      { kind: 'alarmLimitStep', vital: 'hr', side: 'high', direction: 20 }, // one press only
      { kind: 'alarmLimitStep', vital: 'hr', side: 'high', value: 200 }, // no absolute values
      { kind: 'alarmLimitStep', vital: 'hr', side: 'middle', direction: 1 },
      // Nothing but the alarm setup is reachable from a display.
      { kind: 'setVital', vital: 'hr', value: 0 },
      { kind: 'triggerEvent', eventId: 'x' },
      { kind: 'silence', all: true },
      { kind: 'pauseAlarms' },
      { kind: 'end' },
    ];
    for (const raw of junk) {
      expect(applyMonitorRequest(e, raw), JSON.stringify(raw)).toBe(false);
    }
    expect(JSON.stringify({ ...e.snapshot(), log: [] })).toBe(before);
    expect(e.getFullLog().filter((l) => l.detail === 'on a student display')).toEqual([]);
  });

  it('presses Silence: the alarms active now are acknowledged, as the learner\'s act', () => {
    const e = session();
    e.setVital('spo2', 80);
    expect(applyMonitorRequest(e, { kind: 'silence' })).toBe(true);
    expect(e.snapshot().alarms.every((a) => a.acknowledged)).toBe(true);
    expect(e.snapshot().log.at(-1)).toMatchObject({
      label: 'Alarms silenced: SpO₂ LOW 80',
      detail: 'on a student display',
    });
    // It does not pause alarms: that stays the instructor's.
    expect(e.snapshot().alarmsSilenced).toBe(false);
  });

  it('operates the machine\'s alarms the same way', () => {
    const e = session();
    e.setVentShown(true);
    expect(applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'paw', side: 'high', direction: 1 })).toBe(true);
    expect(e.snapshot().alarmLimits!.paw.critHigh).toBe(41);
    expect(applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'mv', side: 'low', direction: -1 })).toBe(true);
    expect(e.snapshot().alarmLimits!.mv.warnLow).toBe(2.5);
    expect(applyMonitorRequest(e, { kind: 'alarmOff', vital: 'fio2', off: true })).toBe(true);
    expect(e.snapshot().alarmsOff).toEqual(['fio2']);
    expect(e.snapshot().log.at(-1)).toMatchObject({ label: 'FiO₂ alarms off', detail: 'on a student display' });
    // Inspired oxygen has no high limit: a well-formed request that changes nothing.
    applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'fio2', side: 'high', direction: -1 });
    expect(e.snapshot().alarmLimits!.fio2).toEqual({ critLow: 20 });
  });

  it('can only ask for alarm actions', () => {
    // The whole vocabulary a display has. Adding a kind here widens what
    // learners can change — see CLAUDE.md invariant 3 before doing so.
    const kinds = monitorRequestSchema.options.map((o) => o.shape.kind.value);
    expect(kinds).toEqual(['alarmLimitStep', 'alarmOff', 'silence']);
  });

  it('keeps limits inside their rules however many presses arrive', () => {
    const e = session();
    for (let i = 0; i < 200; i++) {
      applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'hr', side: 'low', direction: 1 });
    }
    const hr = e.snapshot().alarmLimits!.hr;
    expect(hr.warnLow!).toBeLessThan(hr.warnHigh!);
    for (let i = 0; i < 200; i++) {
      applyMonitorRequest(e, { kind: 'alarmLimitStep', vital: 'spo2', side: 'low', direction: -1 });
    }
    expect(e.snapshot().alarmLimits!.spo2.warnLow).toBeUndefined(); // off at the end of the range
  });
});

describe('counting a request once', () => {
  it('lets each id through once, so a request heard on two transports is one press', () => {
    const fresh = createRequestGate();
    const id = newRequestId();
    expect(fresh(id)).toBe(true);
    expect(fresh(id)).toBe(false);
    expect(fresh(newRequestId())).toBe(true);
  });

  it('refuses a missing or malformed id', () => {
    const fresh = createRequestGate();
    for (const id of [undefined, null, 7, '', 'x'.repeat(65), {}]) {
      expect(fresh(id), String(id)).toBe(false);
    }
  });

  it('remembers only recent ids', () => {
    const fresh = createRequestGate();
    expect(fresh('first')).toBe(true);
    for (let i = 0; i < 64; i++) fresh(`id-${i}`);
    expect(fresh('id-63')).toBe(false);
    expect(fresh('first')).toBe(true); // long gone; a replay this old is a new press
  });

  it('makes ids that do not collide', () => {
    expect(new Set(Array.from({ length: 500 }, newRequestId)).size).toBe(500);
  });
});
