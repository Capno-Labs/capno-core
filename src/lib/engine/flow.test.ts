import { describe, expect, it } from 'vitest';
import { adhocEventId, nextUnfiredEvent } from './flow';
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
