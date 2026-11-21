import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ONBOARDING_KEY,
  deriveChecklist,
  dismissOnboarding,
  markInviteOpened,
  readOnboarding,
  restoreOnboarding,
  type ChecklistInput,
} from './onboarding';

const fresh: ChecklistInput = {
  demoSeen: false,
  sessionCount: 0,
  customScenarioCount: 0,
  role: null,
  inviteUrl: null,
  state: {},
};

describe('deriveChecklist', () => {
  it('shows two self-completing items on a brand-new local workspace', () => {
    const list = deriveChecklist(fresh);
    expect(list.visible).toBe(true);
    expect(list.isNew).toBe(true);
    expect(list.items.map((i) => i.id)).toEqual(['demo', 'import']);
    expect(list.doneCount).toBe(0);
  });

  it('completes the demo item from the tour flag or any archived session', () => {
    expect(deriveChecklist({ ...fresh, demoSeen: true }).items[0].done).toBe(true);
    expect(deriveChecklist({ ...fresh, sessionCount: 2 }).items[0].done).toBe(true);
  });

  it('completes the import item once a custom case exists', () => {
    const list = deriveChecklist({ ...fresh, customScenarioCount: 1 });
    expect(list.items[1].done).toBe(true);
    expect(list.isNew).toBe(false);
  });

  it('offers the invite item only to signed-in faculty with a configured portal', () => {
    const url = 'https://start.example.org/invites';
    expect(deriveChecklist({ ...fresh, inviteUrl: url, role: null }).items).toHaveLength(2);
    expect(deriveChecklist({ ...fresh, inviteUrl: null, role: 'faculty' }).items).toHaveLength(2);
    expect(deriveChecklist({ ...fresh, inviteUrl: url, role: 'admin' }).items).toHaveLength(3);
    const faculty = deriveChecklist({ ...fresh, inviteUrl: url, role: 'faculty' });
    expect(faculty.items[2]).toMatchObject({ id: 'invite', href: url, external: true, done: false });
    expect(
      deriveChecklist({
        ...fresh,
        inviteUrl: url,
        role: 'faculty',
        state: { inviteOpenedAtIso: '2026-01-01T00:00:00.000Z' },
      }).items[2].done,
    ).toBe(true);
  });

  it('hides when dismissed, when everything is done, and for signed-in students', () => {
    expect(
      deriveChecklist({ ...fresh, state: { dismissedAtIso: '2026-01-01T00:00:00.000Z' } }).visible,
    ).toBe(false);
    expect(deriveChecklist({ ...fresh, demoSeen: true, customScenarioCount: 1 }).visible).toBe(false);
    expect(deriveChecklist({ ...fresh, role: 'student' }).visible).toBe(false);
  });
});

describe('onboarding storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    return store;
  }

  it('no-ops without window (Node/SSR)', () => {
    expect(readOnboarding()).toEqual({});
    expect(() => dismissOnboarding()).not.toThrow();
  });

  it('dismisses, and restoring keeps the invite flag', () => {
    const store = stubStorage();
    markInviteOpened();
    dismissOnboarding();
    expect(readOnboarding().dismissedAtIso).toBeTypeOf('string');
    restoreOnboarding();
    const state = readOnboarding();
    expect(state.dismissedAtIso).toBeUndefined();
    expect(state.inviteOpenedAtIso).toBeTypeOf('string');
    expect(store.has(ONBOARDING_KEY)).toBe(true);
  });

  it('ignores corrupt or foreign-shaped values', () => {
    const store = stubStorage();
    store.set(ONBOARDING_KEY, '{not json');
    expect(readOnboarding()).toEqual({});
    store.set(ONBOARDING_KEY, JSON.stringify({ dismissedAtIso: 42, other: true }));
    expect(readOnboarding()).toEqual({});
  });
});
