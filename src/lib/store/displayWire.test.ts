import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../engine/engine';
import type { Scenario } from '../engine/types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { SyncChannel, SyncMessage } from '../sync/types';

/**
 * What leaves the faculty device, and what a student display keeps.
 *
 * The sync channel is joined with a short code, so everything sent on it
 * should be treated as readable by anyone in (or near) the room. These tests
 * stand at the wire: the transports are replaced with a recorder, the real
 * stores run on top of it.
 */

const wire = vi.hoisted(() => ({
  sent: [] as unknown[],
  handlers: new Set<(m: unknown) => void>(),
}));

vi.mock('../sync', () => ({
  createSyncChannels: (): SyncChannel => ({
    kind: 'broadcast',
    send: (m) => {
      // What a transport does: serialise. Anything not in the JSON is not sent.
      wire.sent.push(JSON.parse(JSON.stringify(m)));
    },
    onMessage: (h) => {
      wire.handlers.add(h as (m: unknown) => void);
      return () => wire.handlers.delete(h as (m: unknown) => void);
    },
    onStatus: () => () => {},
    getHealth: () => [{ kind: 'broadcast', state: 'connected' }],
    close: () => wire.handlers.clear(),
  }),
}));

import { useControllerStore } from './controllerStore';
import { useStudentStore } from './studentStore';

const NOTE = 'Jordan froze at the desaturation — follow up privately';

// A scenario with a rubric and events, so every faculty-side record fills up.
const scenario = (): Scenario => {
  const s = BUILT_IN_SCENARIOS.find((x) => x.expectedActions.length > 0 && x.events.length > 0);
  if (!s) throw new Error('no built-in scenario has both actions and events');
  return s;
};

function lastSnapshotSent(): Record<string, unknown> {
  const snapshots = wire.sent.filter(
    (m): m is { type: 'snapshot'; snapshot: Record<string, unknown> } =>
      (m as SyncMessage).type === 'snapshot',
  );
  expect(snapshots.length).toBeGreaterThan(0);
  return snapshots[snapshots.length - 1].snapshot;
}

/** Run a session the way faculty do: start, fire an event, mark, note. */
function runSession() {
  const s = scenario();
  const store = useControllerStore.getState();
  store.loadScenario(s);
  store.start();
  store.triggerEvent(s.events[0].id);
  store.markAction(s.expectedActions[0].id, 'done');
  store.addNote(NOTE);
  vi.advanceTimersByTime(2000);
  return s;
}

beforeEach(() => {
  vi.useFakeTimers();
  wire.sent.length = 0;
  wire.handlers.clear();
});

afterEach(() => {
  useControllerStore.getState().teardown();
  useStudentStore.getState().leave();
  vi.useRealTimers();
});

describe('what the faculty controller sends to displays', () => {
  it('holds the note, the log and the rubric itself', () => {
    runSession();
    const held = useControllerStore.getState().snapshot;
    expect(held?.notes.map((n) => n.text)).toContain(NOTE);
    expect(held?.log.length).toBeGreaterThan(0);
    expect(held?.actions.some((a) => a.status === 'done')).toBe(true);
  });

  it('never sends a faculty note', () => {
    runSession();
    expect(JSON.stringify(wire.sent)).not.toContain(NOTE);
  });

  it('never sends the log, the rubric marks, or which events fired', () => {
    const s = runSession();
    const sent = lastSnapshotSent();
    expect(sent).not.toHaveProperty('notes');
    expect(sent).not.toHaveProperty('log');
    expect(sent).not.toHaveProperty('actions');
    expect(sent).not.toHaveProperty('firedEventIds');
    const everything = JSON.stringify(wire.sent);
    expect(everything).not.toContain(s.expectedActions[0].id);
    expect(everything).not.toContain(s.events[0].id);
  });

  it('never names the case or the phase it is in', () => {
    const s = runSession();
    const sent = lastSnapshotSent();
    expect(sent).not.toHaveProperty('scenarioId');
    expect(sent).not.toHaveProperty('phaseId');
    expect(sent).not.toHaveProperty('sessionId');
    expect(JSON.stringify(wire.sent)).not.toContain(`"${s.id}"`);
  });

  it('still sends everything the monitor draws', () => {
    runSession();
    const held = useControllerStore.getState().snapshot;
    const sent = lastSnapshotSent();
    expect(sent.status).toBe('running');
    expect(sent.elapsedSec).toBe(held?.elapsedSec);
    expect(sent.vitals).toEqual(held?.vitals);
    expect(sent.alarms).toEqual(held?.alarms);
    expect(sent.alarmLimits).toEqual(held?.alarmLimits);
    expect(sent.nibp).toEqual(held?.nibp);
  });

  it('answers a late display with the same trimmed snapshot', () => {
    runSession();
    wire.sent.length = 0;
    for (const h of [...wire.handlers]) h({ type: 'hello' });
    expect(lastSnapshotSent()).not.toHaveProperty('notes');
    expect(JSON.stringify(wire.sent)).not.toContain(NOTE);
  });
});

describe('what a student display keeps', () => {
  // A full snapshot, as a controller tab that has not picked up this change
  // (or anyone else on the channel) would send it.
  function fullSnapshot() {
    const s = scenario();
    const engine = new SimulationEngine(s, 'TEST');
    engine.start();
    engine.addNote(NOTE);
    engine.markAction(s.expectedActions[0].id, 'done');
    return JSON.parse(JSON.stringify(engine.snapshot()));
  }

  it('drops everything but the monitor fields from what it hears', () => {
    const full = fullSnapshot();
    useStudentStore.getState().join('ABCD');
    for (const h of [...wire.handlers]) h({ type: 'snapshot', snapshot: full });

    const { snapshot, phase } = useStudentStore.getState();
    expect(phase).toBe('live');
    expect(JSON.stringify(snapshot)).not.toContain(NOTE);
    expect(snapshot).not.toHaveProperty('notes');
    expect(snapshot).not.toHaveProperty('log');
    expect(snapshot).not.toHaveProperty('actions');
    expect(snapshot).not.toHaveProperty('scenarioId');
    expect(snapshot?.vitals).toEqual(full.vitals);
    expect(snapshot?.status).toBe('running');
  });
});
