import { describe, expect, it } from 'vitest';
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  amendPresent,
  canRedo,
  canUndo,
  createHistory,
  pushEdit,
  redo,
  undo,
} from './editHistory';

describe('editHistory', () => {
  it('undoes and redoes separate edits', () => {
    let h = createHistory('a');
    h = pushEdit(h, 'b', 0);
    h = pushEdit(h, 'c', 5000);
    expect(undo(h).present).toBe('b');
    expect(undo(undo(h)).present).toBe('a');
    expect(redo(undo(h)).present).toBe('c');
  });

  it('collapses a burst of edits into one undo step', () => {
    let h = createHistory('');
    h = pushEdit(h, 'h', 1000);
    h = pushEdit(h, 'he', 1100);
    h = pushEdit(h, 'hey', 1100 + COALESCE_MS - 1);
    expect(h.past).toEqual(['']);
    expect(undo(h).present).toBe('');
  });

  it('always keeps the starting document reachable', () => {
    // The very first edit is its own step even if it lands "instantly".
    const h = pushEdit(createHistory('saved'), 'edited', 0);
    expect(undo(h).present).toBe('saved');
  });

  it('starts a new step after an undo, and drops the redo branch', () => {
    let h = createHistory('a');
    h = pushEdit(h, 'b', 0);
    h = undo(h);
    h = pushEdit(h, 'x', 10);
    expect(h.past).toEqual(['a']);
    expect(canRedo(h)).toBe(false);
  });

  it('does not coalesce onto a wholesale replacement', () => {
    let h = createHistory('a');
    h = pushEdit(h, 'imported', 0, false);
    h = pushEdit(h, 'imported + edit', 10);
    expect(undo(h).present).toBe('imported');
    expect(undo(undo(h)).present).toBe('a');
  });

  it('caps the undo stack', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = pushEdit(h, i, i * 10_000);
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });

  it('amends the present without adding a step', () => {
    const h = amendPresent(pushEdit(createHistory('a'), 'b', 0), 'b2');
    expect(h.present).toBe('b2');
    expect(undo(h).present).toBe('a');
  });

  it('is a no-op at either end', () => {
    const h = createHistory('a');
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
