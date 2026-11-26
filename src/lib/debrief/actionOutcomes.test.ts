import { describe, expect, it } from 'vitest';

import type { ActionRecord, ExpectedAction, LogEntry, ScenarioEvent } from '../engine/types';
import { deriveActionOutcomes, isGap, type ActionOutcomeInput } from './actionOutcomes';

const action = (id: string, over: Partial<ExpectedAction> = {}): ExpectedAction => ({
  id,
  label: `Action ${id}`,
  critical: false,
  points: 10,
  ...over,
});

const event = (id: string, label: string, actionIds?: string[]): ScenarioEvent => ({
  id,
  label,
  category: 'airway',
  effects: [],
  ...(actionIds ? { actionIds } : {}),
});

const fired = (t: number, label: string): LogEntry => ({ t, kind: 'event', label });

const input = (over: {
  actions?: ExpectedAction[];
  records?: ActionRecord[];
  events?: ScenarioEvent[];
  log?: LogEntry[];
}): ActionOutcomeInput => ({
  scenario: {
    expectedActions: over.actions ?? [],
    events: over.events ?? [],
    phases: [{ id: 'crisis', label: 'Crisis' }],
  },
  snapshot: { actions: over.records ?? [], log: over.log ?? [] },
});

describe('deriveActionOutcomes', () => {
  it('keeps the scenario order and carries the mark and its time', () => {
    const outcomes = deriveActionOutcomes(
      input({
        actions: [action('a'), action('b')],
        records: [
          { actionId: 'b', status: 'delayed', markedAtSec: 90 },
          { actionId: 'a', status: 'done', markedAtSec: 30 },
        ],
      }),
    );
    expect(outcomes.map((o) => [o.action.id, o.status, o.markedAtSec])).toEqual([
      ['a', 'done', 30],
      ['b', 'delayed', 90],
    ]);
  });

  it('reads an unmarked or pending action as missed', () => {
    const outcomes = deriveActionOutcomes(
      input({
        actions: [action('a'), action('b')],
        records: [{ actionId: 'a', status: 'pending' }],
      }),
    );
    expect(outcomes.map((o) => o.status)).toEqual(['missed', 'missed']);
    expect(outcomes[0].markedAtSec).toBeUndefined();
  });

  it('times the trigger from the first firing of an event linked by actionIds', () => {
    const outcomes = deriveActionOutcomes(
      input({
        actions: [action('a'), action('b')],
        events: [event('e1', 'Spasm', ['a']), event('e2', 'Desaturation', ['a'])],
        log: [fired(250, 'Desaturation'), fired(200, 'Spasm'), fired(400, 'Spasm')],
      }),
    );
    expect(outcomes[0].triggeredAtSec).toBe(200);
    expect(outcomes[0].triggerLabel).toBe('Spasm');
    expect(outcomes[1].triggeredAtSec).toBeUndefined();
  });

  it('leaves the trigger out when the linked event never fired', () => {
    const [outcome] = deriveActionOutcomes(
      input({ actions: [action('a')], events: [event('e1', 'Spasm', ['a'])] }),
    );
    expect(outcome.triggeredAtSec).toBeUndefined();
  });

  it('resolves the phase label', () => {
    const [known, unknown] = deriveActionOutcomes(
      input({ actions: [action('a', { phase: 'crisis' }), action('b', { phase: 'nope' })] }),
    );
    expect(known.phaseLabel).toBe('Crisis');
    expect(unknown.phaseLabel).toBeUndefined();
  });
});

describe('isGap', () => {
  it('is everything except done', () => {
    const outcomes = deriveActionOutcomes(
      input({
        actions: [action('a'), action('b'), action('c'), action('d')],
        records: [
          { actionId: 'a', status: 'done' },
          { actionId: 'b', status: 'delayed' },
          { actionId: 'c', status: 'incorrect' },
        ],
      }),
    );
    expect(outcomes.map(isGap)).toEqual([false, true, true, true]);
  });
});
