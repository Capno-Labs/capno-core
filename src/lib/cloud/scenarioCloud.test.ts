import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '../engine/types';
import { BUILT_IN_SCENARIOS } from '../scenarios/registry';
import { getVersionHistory, saveCustomScenario } from '../scenarios/customStore';
import { getSyncMeta, isQueued } from './outbox';
import { mergeCloudScenarios, type CloudScenario } from './scenarioCloud';

// Minimal in-memory localStorage — plain object, no DOM (Node env).
let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function scenario(title: string): Scenario {
  return { ...BUILT_IN_SCENARIOS[0], id: 'merge-test', title };
}

/** Save a local head and pin its savedAtIso to a known instant. */
function saveLocal(s: Scenario, savedAtIso: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(savedAtIso));
  expect(saveCustomScenario(s).ok).toBe(true);
  vi.useRealTimers();
}

describe('mergeCloudScenarios', () => {
  const T = '2026-05-01T10:00:00.000Z';

  it('a published cloud head wins an exact timestamp tie; a draft does not', () => {
    saveLocal(scenario('Local edit'), T);
    const published: CloudScenario = {
      scenario: scenario('Approved copy'),
      updatedAtIso: T,
      status: 'published',
      approvedVersionId: 9,
    };
    expect(mergeCloudScenarios([published])).toEqual({ updated: 1 });
    const head = getVersionHistory('merge-test')[0];
    expect(head.scenario.title).toBe('Approved copy');
    // The losing local head survives in history.
    expect(getVersionHistory('merge-test')[1].scenario.title).toBe('Local edit');
    expect(isQueued('scenario', 'merge-test')).toBe(false);
    // The adopted head is known to equal version 9 → runs can pin to it.
    expect(getSyncMeta('scenario', 'merge-test')).toMatchObject({
      cloudVersionId: 9,
      cloudStatus: 'published',
      pushedSavedAtIso: head.savedAtIso,
    });
  });

  it('a draft cloud head loses the tie and the local head is re-queued', () => {
    saveLocal(scenario('Local edit'), T);
    const draft: CloudScenario = { scenario: scenario('Cloud draft'), updatedAtIso: T, status: 'draft' };
    expect(mergeCloudScenarios([draft])).toEqual({ updated: 0 });
    expect(getVersionHistory('merge-test')[0].scenario.title).toBe('Local edit');
    expect(isQueued('scenario', 'merge-test')).toBe(true);
  });

  it('a published head older than the local head still loses (LWW)', () => {
    saveLocal(scenario('Newer local'), '2026-05-01T11:00:00.000Z');
    const stale: CloudScenario = {
      scenario: scenario('Older approved'),
      updatedAtIso: T,
      status: 'published',
      approvedVersionId: 3,
    };
    mergeCloudScenarios([stale]);
    expect(getVersionHistory('merge-test')[0].scenario.title).toBe('Newer local');
    expect(isQueued('scenario', 'merge-test')).toBe(true);
  });

  it('matching heads record the review state without a save', () => {
    const same = scenario('Same');
    saveLocal(same, T);
    mergeCloudScenarios([{ scenario: same, updatedAtIso: T, status: 'review' }]);
    expect(getVersionHistory('merge-test')).toHaveLength(1);
    expect(getSyncMeta('scenario', 'merge-test')?.cloudStatus).toBe('review');
    // A draft/review head does not claim a version id it cannot know.
    expect(getSyncMeta('scenario', 'merge-test')?.cloudVersionId).toBeUndefined();
  });
});
