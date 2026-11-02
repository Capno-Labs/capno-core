import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueue,
  getPushedAt,
  getSyncMeta,
  isCloudScenarioStatus,
  markPushed,
  pinnedVersionId,
} from './outbox';

const SYNC_META_KEY = 'capno:cloud-sync-meta:v1';

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

describe('sync meta', () => {
  it('round-trips cloudVersionId and review state through storage', () => {
    markPushed('scenario', 'airway', {
      cloudVersionId: 42,
      pushedSavedAtIso: '2026-05-01T10:00:00.000Z',
      cloudStatus: 'published',
    });

    const raw = JSON.parse(store.get(SYNC_META_KEY) ?? '{}') as Record<string, unknown>;
    // Same key and same `<kind>:<id>` entries as before — additive fields only.
    expect(Object.keys(raw)).toEqual(['scenario:airway']);
    expect(raw['scenario:airway']).toMatchObject({ cloudVersionId: 42, cloudStatus: 'published' });

    const entry = getSyncMeta('scenario', 'airway');
    expect(entry?.cloudVersionId).toBe(42);
    expect(entry?.pushedSavedAtIso).toBe('2026-05-01T10:00:00.000Z');
    expect(entry?.cloudStatus).toBe('published');
    expect(getPushedAt('scenario', 'airway')).toBe(entry?.pushedAtIso);
  });

  it('markPushed without a patch keeps the recorded version (drain follows the handler)', () => {
    markPushed('scenario', 'airway', { cloudVersionId: 7, cloudStatus: 'draft' });
    markPushed('scenario', 'airway');
    expect(getSyncMeta('scenario', 'airway')).toMatchObject({ cloudVersionId: 7, cloudStatus: 'draft' });
  });

  it('a patch can forget a field (unknown status after a push to an old database)', () => {
    markPushed('scenario', 'airway', { cloudVersionId: 7, cloudStatus: 'published' });
    markPushed('scenario', 'airway', { cloudStatus: undefined });
    const entry = getSyncMeta('scenario', 'airway');
    expect(entry?.cloudVersionId).toBe(7);
    expect(entry?.cloudStatus).toBeUndefined();
    expect('cloudStatus' in (JSON.parse(store.get(SYNC_META_KEY) ?? '{}')['scenario:airway'] ?? {})).toBe(
      false,
    );
  });

  it('reads pre-0004 entries that only have pushedAtIso', () => {
    store.set(SYNC_META_KEY, JSON.stringify({ 'session:AB12': { pushedAtIso: '2026-01-01T00:00:00.000Z' } }));
    expect(getPushedAt('session', 'AB12')).toBe('2026-01-01T00:00:00.000Z');
    expect(getSyncMeta('session', 'AB12')?.cloudVersionId).toBeUndefined();
    expect(getSyncMeta('scenario', 'missing')).toBeNull();
  });

  it('isCloudScenarioStatus accepts only the three states', () => {
    expect(isCloudScenarioStatus('draft')).toBe(true);
    expect(isCloudScenarioStatus('review')).toBe(true);
    expect(isCloudScenarioStatus('published')).toBe(true);
    expect(isCloudScenarioStatus('archived')).toBe(false);
    expect(isCloudScenarioStatus(null)).toBe(false);
  });
});

describe('pinnedVersionId', () => {
  const saved = '2026-05-01T10:00:00.000Z';

  it('returns the version only when the local head is the pushed one', () => {
    markPushed('scenario', 'airway', { cloudVersionId: 42, pushedSavedAtIso: saved });
    expect(pinnedVersionId('airway', saved)).toBe(42);
    // Edited and saved locally since the push → the cloud row differs.
    expect(pinnedVersionId('airway', '2026-05-01T10:05:00.000Z')).toBeNull();
    expect(pinnedVersionId('airway', undefined)).toBeNull();
  });

  it('returns null for never-pushed scenarios and while a push is queued', () => {
    expect(pinnedVersionId('bundled', saved)).toBeNull();
    markPushed('scenario', 'airway', { cloudVersionId: 42, pushedSavedAtIso: saved });
    enqueue('scenario', 'airway');
    expect(pinnedVersionId('airway', saved)).toBeNull();
  });
});
