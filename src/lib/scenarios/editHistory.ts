/**
 * Undo/redo history for the case editor — a plain value, so it lives in
 * React state and is testable without a DOM. Edits that arrive in quick
 * succession (typing in one field) collapse into a single undo step.
 */

export interface EditHistory<T> {
  past: T[];
  present: T;
  future: T[];
  /** When the present was last written by an edit; -Infinity closes the step. */
  lastEditAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 700;

export function createHistory<T>(present: T): EditHistory<T> {
  return { past: [], present, future: [], lastEditAt: -Infinity };
}

/**
 * Record an edit. With `coalesce`, an edit within COALESCE_MS of the previous
 * one replaces the present instead of adding an undo step.
 */
export function pushEdit<T>(
  history: EditHistory<T>,
  next: T,
  now: number,
  coalesce = true,
): EditHistory<T> {
  if (coalesce && history.past.length > 0 && now - history.lastEditAt < COALESCE_MS) {
    return { ...history, present: next, future: [], lastEditAt: now };
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastEditAt: coalesce ? now : -Infinity,
  };
}

/** Swap the present without touching the undo stack (e.g. an id assigned on save). */
export function amendPresent<T>(history: EditHistory<T>, present: T): EditHistory<T> {
  return { ...history, present };
}

export function canUndo<T>(history: EditHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: EditHistory<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canUndo(history)) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastEditAt: -Infinity,
  };
}

export function redo<T>(history: EditHistory<T>): EditHistory<T> {
  if (!canRedo(history)) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastEditAt: -Infinity,
  };
}
