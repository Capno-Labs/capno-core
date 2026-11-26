import { describe, expect, it } from 'vitest';
import { validateScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';
import {
  addAction,
  addEvent,
  addPhase,
  describeEffect,
  describeEvent,
  describeTrigger,
  duplicateEvent,
  groupByPhase,
  idFromLabel,
  moveWithinGroup,
  removeAction,
  removePhase,
  setActionLabel,
  setEventLabel,
  setPhaseLabel,
} from './progression';
import { BUILT_IN_SCENARIOS } from './registry';

const apply = (s: Scenario, patch: Partial<Scenario>): Scenario => ({ ...s, ...patch });
const anaphylaxis = () =>
  JSON.parse(JSON.stringify(BUILT_IN_SCENARIOS.find((s) => s.id === 'anaphylaxis'))) as Scenario;

describe('idFromLabel', () => {
  it('slugs the label and avoids taken ids', () => {
    expect(idFromLabel('Give epinephrine', [], 'action')).toBe('give-epinephrine');
    expect(idFromLabel('Give epinephrine', ['give-epinephrine'], 'action')).toBe('give-epinephrine-2');
    expect(idFromLabel('', ['phase', 'phase-2'], 'phase')).toBe('phase-3');
  });
});

describe('phases', () => {
  it('a new phase is valid once it has a label, and its id follows the label', () => {
    let s = anaphylaxis();
    const added = addPhase(s);
    s = apply(s, added.patch);
    const index = s.phases.length - 1;
    s = apply(s, setPhaseLabel(s, index, 'Recovery room', true));
    expect(s.phases[index]).toEqual({ id: 'recovery-room', label: 'Recovery room' });
    expect(validateScenario(s).ok).toBe(true);
  });

  it('renaming a new phase carries its events and actions along', () => {
    let s = anaphylaxis();
    const old = s.phases[1].id;
    const before = groupByPhase(s)[1];
    s = apply(s, setPhaseLabel(s, 1, 'Something else entirely', true));
    expect(s.phases[1].id).toBe('something-else-entirely');
    expect(s.events.some((e) => e.phaseHint === old)).toBe(false);
    expect(groupByPhase(s)[1]).toEqual({ ...before, phaseId: 'something-else-entirely' });
    expect(validateScenario(s).ok).toBe(true);
  });

  it('a saved phase keeps its id when relabelled', () => {
    const s = anaphylaxis();
    const next = apply(s, setPhaseLabel(s, 1, 'New words', false));
    expect(next.phases[1].id).toBe(s.phases[1].id);
    expect(next.events).toBe(s.events);
  });

  it('removing a phase keeps what was in it, with no phase', () => {
    const s = anaphylaxis();
    const { id } = s.phases[1];
    const inside = groupByPhase(s)[1];
    const next = apply(s, removePhase(s, 1));
    expect(next.phases.some((p) => p.id === id)).toBe(false);
    expect(next.events.length).toBe(s.events.length);
    expect(next.expectedActions.length).toBe(s.expectedActions.length);
    const loose = groupByPhase(next).at(-1)!;
    expect(loose.phaseId).toBeNull();
    expect(loose.events.length).toBeGreaterThanOrEqual(inside.events.length);
    expect(loose.actions.length).toBeGreaterThanOrEqual(inside.actions.length);
    expect(validateScenario(next).ok).toBe(true);
  });
});

describe('events', () => {
  it('adds an event to a phase with its own id', () => {
    let s = anaphylaxis();
    const phaseId = s.phases[0].id;
    const added = addEvent(s, phaseId, { category: 'physiology', autoAtSec: 0, effects: [{}] });
    s = apply(s, added.patch);
    expect(s.events[added.index].phaseHint).toBe(phaseId);
    expect(new Set(s.events.map((e) => e.id)).size).toBe(s.events.length);
    s = apply(s, setEventLabel(s, added.index, 'Sudden hypotension', true));
    expect(s.events[added.index].id).toBe('sudden-hypotension');
    expect(validateScenario(s).ok).toBe(true);
  });

  it('duplicates an event beside the original without sharing its effects', () => {
    const s = anaphylaxis();
    const dup = duplicateEvent(s, 2);
    const next = apply(s, dup.patch);
    expect(dup.index).toBe(3);
    expect(next.events[3].label).toBe(`${s.events[2].label} (copy)`);
    expect(next.events[3].id).not.toBe(s.events[2].id);
    expect(next.events[3].effects).toEqual(s.events[2].effects);
    expect(next.events[3].effects).not.toBe(s.events[2].effects);
    expect(validateScenario(next).ok).toBe(true);
  });
});

describe('expected actions', () => {
  it('adds an action whose id comes from its label', () => {
    const s = anaphylaxis();
    const added = addAction(s, s.phases[0].id, 'Check the anesthesia machine');
    const next = apply(s, added.patch);
    expect(next.expectedActions.at(-1)).toEqual({
      id: 'check-the-anesthesia-machine',
      label: 'Check the anesthesia machine',
      critical: false,
      points: 0,
      phase: s.phases[0].id,
    });
    expect(validateScenario(next).ok).toBe(true);
  });

  it('a renamed id keeps its event links and rubric membership', () => {
    const s = anaphylaxis();
    const index = s.expectedActions.findIndex(
      (a) => s.events.some((e) => e.actionIds?.includes(a.id)) && s.rubric.some((c) => c.actionIds.includes(a.id)),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const old = s.expectedActions[index].id;
    const next = apply(s, setActionLabel(s, index, 'A brand new label', true));
    const id = next.expectedActions[index].id;
    expect(id).toBe('a-brand-new-label');
    const count = (sc: Scenario, x: string) =>
      sc.events.filter((e) => e.actionIds?.includes(x)).length + sc.rubric.filter((c) => c.actionIds.includes(x)).length;
    expect(count(next, id)).toBe(count(s, old));
    expect(count(next, old)).toBe(0);
    expect(validateScenario(next).ok).toBe(true);
  });

  it('removing an action removes every link to it', () => {
    for (const source of BUILT_IN_SCENARIOS) {
      const s = JSON.parse(JSON.stringify(source)) as Scenario;
      const { id } = s.expectedActions[0];
      const next = apply(s, removeAction(s, 0));
      expect(JSON.stringify([next.events, next.rubric])).not.toContain(`"${id}"`);
      expect(next.events.every((e) => e.actionIds === undefined || e.actionIds.length > 0)).toBe(true);
      expect(validateScenario(next).ok, source.id).toBe(true);
    }
  });
});

describe('groupByPhase', () => {
  it('places every event and action exactly once', () => {
    for (const s of BUILT_IN_SCENARIOS) {
      const groups = groupByPhase(s);
      expect(groups.flatMap((g) => g.events).sort((a, b) => a - b)).toEqual(s.events.map((_, i) => i));
      expect(groups.flatMap((g) => g.actions).sort((a, b) => a - b)).toEqual(s.expectedActions.map((_, i) => i));
    }
  });

  it('has no loose group when everything has a phase', () => {
    const s = anaphylaxis();
    const tidy = {
      ...s,
      events: s.events.map((e) => ({ ...e, phaseHint: s.phases[0].id })),
      expectedActions: s.expectedActions.map((a) => ({ ...a, phase: s.phases[0].id })),
    };
    expect(groupByPhase(tidy).map((g) => g.phaseId)).toEqual(s.phases.map((p) => p.id));
  });
});

describe('moveWithinGroup', () => {
  it('swaps with the neighbour in the group and leaves the rest in place', () => {
    const items = ['a', 'B1', 'c', 'B2', 'd', 'B3'];
    const group = [1, 3, 5];
    expect(moveWithinGroup(items, group, 3, -1)).toEqual(['a', 'B2', 'c', 'B1', 'd', 'B3']);
    expect(moveWithinGroup(items, group, 3, 1)).toEqual(['a', 'B1', 'c', 'B3', 'd', 'B2']);
    expect(moveWithinGroup(items, group, 1, -1)).toEqual(items);
    expect(moveWithinGroup(items, group, 5, 1)).toEqual(items);
  });
});

describe('summaries', () => {
  it('describes a trigger', () => {
    expect(describeTrigger({ autoAtSec: 240 })).toBe('Automatically at 4:00');
    expect(describeTrigger({})).toBe('When faculty fires it');
  });

  it('describes an effect the way faculty would say it', () => {
    expect(
      describeEffect({ vitals: { sbp: 92, dbp: 52, hr: 104, etco2: 32 }, rhythm: 'sinus_tach', overSec: 90 }),
    ).toBe('BP 92/52 · HR 104 · EtCO₂ 32 · Sinus Tachycardia, over 1:30');
    expect(describeEffect({ vitals: { sbp: 80 }, afterSec: 30, overSec: 60 })).toBe(
      'Systolic 80, after 0:30, over 1:00',
    );
    expect(describeEffect({})).toBe('');
    expect(describeEffect({ overSec: 30 })).toBe('');
  });

  it('describes an event with no effects as a log note', () => {
    expect(describeEvent({ effects: [] })).toMatch(/note in the log/);
    expect(describeEvent({ effects: [{}] })).toMatch(/note in the log/);
  });

  it('has something to say about every built-in effect', () => {
    for (const s of BUILT_IN_SCENARIOS) {
      for (const e of s.events) for (const fx of e.effects) expect(describeEffect(fx), `${s.id}/${e.id}`).not.toBe('');
    }
  });
});
