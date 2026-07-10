import { describe, expect, it } from 'vitest';
import type { ArchivedSession } from '../engine/types';
import { quotaFallbacks } from './sessionArchive';

/** Minimal stand-in — quotaFallbacks only touches sessionId + history. */
function fakeSession(n: number, withHistory = true): ArchivedSession {
  return {
    sessionId: `S${n}`,
    endedAtIso: `2026-01-0${(n % 9) + 1}T00:00:00.000Z`,
    ...(withHistory ? { history: [{ tSec: 0, vitals: {} }] } : {}),
  } as unknown as ArchivedSession;
}

describe('quotaFallbacks', () => {
  it('returns progressively smaller candidates', () => {
    const sessions = Array.from({ length: 60 }, (_, i) => fakeSession(i));
    const [full, stripped, reduced] = quotaFallbacks(sessions);

    expect(full).toHaveLength(50);
    expect(stripped).toHaveLength(50);
    expect(reduced).toHaveLength(25);
  });

  it('strips history from older sessions first, keeping the newest intact', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => fakeSession(i));
    const [, stripped, reduced] = quotaFallbacks(sessions);

    // Newest-first ordering: the first 10 keep history, the rest lose it.
    expect(stripped.slice(0, 10).every((s) => s.history !== undefined)).toBe(true);
    expect(stripped.slice(10).every((s) => !('history' in s))).toBe(true);
    // Final fallback keeps history only on the newest session.
    expect(reduced[0].history).toBeDefined();
    expect(reduced.slice(1).every((s) => !('history' in s))).toBe(true);
  });

  it('does not mutate the input or reorder sessions', () => {
    const sessions = Array.from({ length: 15 }, (_, i) => fakeSession(i));
    const before = JSON.stringify(sessions);
    const [full, stripped] = quotaFallbacks(sessions);

    expect(JSON.stringify(sessions)).toBe(before);
    expect(full.map((s) => s.sessionId)).toEqual(sessions.map((s) => s.sessionId));
    expect(stripped.map((s) => s.sessionId)).toEqual(sessions.map((s) => s.sessionId));
  });

  it('leaves history-less sessions untouched', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => fakeSession(i, false));
    const [, stripped] = quotaFallbacks(sessions);
    expect(stripped).toEqual(sessions);
  });
});
