import { describe, expect, it } from 'vitest';
import {
  adhocEventId,
  nextPhase,
  nextUnfiredEvent,
  paceAgainst,
  phasePace,
  sessionBudgetSec,
  sessionPace,
} from './flow';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import type { Phase, Scenario, ScenarioEvent } from './types';

const ev = (id: string): ScenarioEvent => ({ id, label: id, category: 'other', effects: [] });
const events = [ev('a'), ev('b'), ev('c')];

describe('nextUnfiredEvent', () => {
  it('returns the first event in author order when nothing has fired', () => {
    expect(nextUnfiredEvent(events, new Set())?.id).toBe('a');
  });

  it('skips fired events regardless of firing order', () => {
    expect(nextUnfiredEvent(events, new Set(['a']))?.id).toBe('b');
    // Firing out of order still points at the earliest unfired one.
    expect(nextUnfiredEvent(events, new Set(['b']))?.id).toBe('a');
    expect(nextUnfiredEvent(events, ['a', 'c'])?.id).toBe('b');
  });

  it('returns undefined once every event has fired', () => {
    expect(nextUnfiredEvent(events, ['a', 'b', 'c'])).toBeUndefined();
    expect(nextUnfiredEvent([], new Set())).toBeUndefined();
  });

  it('a pinned unfired event wins over author order', () => {
    expect(nextUnfiredEvent(events, new Set(), 'c')?.id).toBe('c');
    expect(nextUnfiredEvent(events, new Set(['a']), 'c')?.id).toBe('c');
  });

  it('a pin on a fired event is inert — author order resumes', () => {
    expect(nextUnfiredEvent(events, new Set(['c']), 'c')?.id).toBe('a');
  });

  it('a null or unknown pin preserves the unpinned behavior', () => {
    expect(nextUnfiredEvent(events, new Set(), null)?.id).toBe('a');
    expect(nextUnfiredEvent(events, new Set(), 'nope')?.id).toBe('a');
  });
});

describe('adhocEventId', () => {
  it('returns adhoc-1 when no ad-hoc ids are taken', () => {
    expect(adhocEventId(events)).toBe('adhoc-1');
    expect(adhocEventId([])).toBe('adhoc-1');
  });

  it('returns the smallest unused adhoc-N', () => {
    expect(adhocEventId([...events, ev('adhoc-1')])).toBe('adhoc-2');
    expect(adhocEventId([ev('adhoc-1'), ev('adhoc-2')])).toBe('adhoc-3');
    // A gap is reused — ids only need to be unique, not sequential.
    expect(adhocEventId([ev('adhoc-2')])).toBe('adhoc-1');
  });
});

describe('pacing', () => {
  const base: Scenario = BUILT_IN_SCENARIOS[0];
  const phases: Phase[] = [
    { id: 'a', label: 'A', targetDurationSec: 120 },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C', targetDurationSec: 60 },
  ];
  const scenario: Scenario = { ...base, phases, estimatedMinutes: 15, targetDurationSec: undefined };

  describe('paceAgainst', () => {
    it('counts down while inside the budget', () => {
      expect(paceAgainst(200, 600)).toEqual({ budgetSec: 600, remainingSec: 400, overBySec: 0, state: 'ok' });
    });

    it('flags the last tenth of the budget', () => {
      expect(paceAgainst(539, 600).state).toBe('ok');
      expect(paceAgainst(540, 600).state).toBe('low');
      expect(paceAgainst(600, 600)).toMatchObject({ remainingSec: 0, overBySec: 0, state: 'low' });
    });

    it('counts up once over', () => {
      expect(paceAgainst(680, 600)).toEqual({ budgetSec: 600, remainingSec: 0, overBySec: 80, state: 'over' });
    });
  });

  describe('sessionPace', () => {
    it('uses the library estimate when no lab-slot budget is authored', () => {
      expect(sessionBudgetSec(scenario)).toBe(900);
      expect(sessionPace(scenario, 300).remainingSec).toBe(600);
    });

    it('prefers the authored lab-slot budget', () => {
      const timed = { ...scenario, targetDurationSec: 480 };
      expect(sessionPace(timed, 500)).toMatchObject({ budgetSec: 480, overBySec: 20, state: 'over' });
    });
  });

  describe('phasePace', () => {
    it('measures time since the phase began, against its target', () => {
      const p = phasePace(scenario, { phaseId: 'c', phaseChangedAtSec: 300, elapsedSec: 345 });
      expect(p.phase?.id).toBe('c');
      expect(p.elapsedInPhaseSec).toBe(45);
      expect(p.pace).toMatchObject({ budgetSec: 60, remainingSec: 15, state: 'ok' });
    });

    it('has no pace for a phase without a target', () => {
      const p = phasePace(scenario, { phaseId: 'b', phaseChangedAtSec: 100, elapsedSec: 400 });
      expect(p.elapsedInPhaseSec).toBe(300);
      expect(p.pace).toBeUndefined();
    });

    it('treats a snapshot without a phase-change time as starting at zero', () => {
      const p = phasePace(scenario, { phaseId: 'a', elapsedSec: 130 });
      expect(p.elapsedInPhaseSec).toBe(130);
      expect(p.pace?.state).toBe('over');
    });

    it('copes with a phase id the scenario does not have', () => {
      const p = phasePace(scenario, { phaseId: 'zzz', phaseChangedAtSec: 0, elapsedSec: 10 });
      expect(p.phase).toBeUndefined();
      expect(p.pace).toBeUndefined();
    });
  });

  describe('nextPhase', () => {
    it('steps through the phases in author order and stops at the last', () => {
      expect(nextPhase(phases, 'a')?.id).toBe('b');
      expect(nextPhase(phases, 'b')?.id).toBe('c');
      expect(nextPhase(phases, 'c')).toBeUndefined();
      expect(nextPhase(phases, 'zzz')).toBeUndefined();
    });
  });
});
