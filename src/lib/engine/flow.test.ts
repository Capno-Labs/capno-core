import { describe, expect, it } from 'vitest';
import { nextUnfiredEvent } from './flow';
import type { ScenarioEvent } from './types';

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
});
