import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEMO_SEEN_KEY, DEMO_TOUR_STEPS, hasSeenDemo, markDemoSeen } from './demoTour';

describe('demo tour steps', () => {
  it('has unique ids and starts/ends with centered cards', () => {
    const ids = DEMO_TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEMO_TOUR_STEPS[0].anchor).toBeNull();
    expect(DEMO_TOUR_STEPS[DEMO_TOUR_STEPS.length - 1].anchor).toBeNull();
  });

  it('anchors only to data-tour selectors, so drift is greppable', () => {
    for (const step of DEMO_TOUR_STEPS) {
      if (step.anchor !== null) {
        expect(step.anchor).toMatch(/^\[data-tour="[a-z-]+"\]$/);
      }
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});

describe('demo seen flag', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('no-ops without window (Node/SSR)', () => {
    expect(hasSeenDemo()).toBe(false);
    expect(() => markDemoSeen()).not.toThrow();
  });

  it('round-trips through localStorage under the versioned key', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    expect(hasSeenDemo()).toBe(false);
    markDemoSeen();
    expect(hasSeenDemo()).toBe(true);
    const stored = JSON.parse(store.get(DEMO_SEEN_KEY)!) as { seenAtIso: string };
    expect(new Date(stored.seenAtIso).getTime()).not.toBeNaN();
  });

  it('swallows storage failures (private browsing)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });
    expect(hasSeenDemo()).toBe(false);
    expect(() => markDemoSeen()).not.toThrow();
  });
});
