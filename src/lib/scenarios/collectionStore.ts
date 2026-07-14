'use client';

import { type ScenarioCollection, slugifyCollectionId } from './collections';

/**
 * Local persistence for scenario collections. Mirrors customStore.ts, with
 * two deliberate divergences: no per-record version history (collections
 * are tiny id-list metadata, not authored content worth versioning) and no
 * migrateLegacyKey (the key has no labsim:* ancestor).
 *
 * Reads are id-keyed like the custom store, so a future cloud outbox kind
 * ('collection') can re-read current state at push time with no reshaping.
 */

const KEY = 'capno:collections:v1';

function readAll(): ScenarioCollection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScenarioCollection[]) : [];
  } catch {
    return [];
  }
}

function writeAll(collections: ScenarioCollection[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(collections));
    return true;
  } catch {
    // Storage full or unavailable.
    return false;
  }
}

export function listCollections(): ScenarioCollection[] {
  return readAll();
}

export function getCollection(id: string): ScenarioCollection | undefined {
  return readAll().find((c) => c.id === id);
}

export type SaveCollectionResult = { ok: true } | { ok: false; error: string };

/** Upsert by id, stamping updatedAtIso. */
export function saveCollection(collection: ScenarioCollection): SaveCollectionResult {
  const collections = readAll();
  const stamped = { ...collection, updatedAtIso: new Date().toISOString() };
  const index = collections.findIndex((c) => c.id === collection.id);
  if (index >= 0) collections[index] = stamped;
  else collections.push(stamped);
  if (writeAll(collections)) return { ok: true };
  return {
    ok: false,
    error: 'Device storage is full — the collection was NOT saved. Free space (delete old sessions or scenarios) and try again.',
  };
}

export function createCollection(title: string, description?: string): ScenarioCollection | null {
  const now = new Date().toISOString();
  const collection: ScenarioCollection = {
    id: slugifyCollectionId(title, new Set(readAll().map((c) => c.id))),
    title: title.trim(),
    ...(description ? { description } : {}),
    scenarioIds: [],
    createdAtIso: now,
    updatedAtIso: now,
  };
  return saveCollection(collection).ok ? collection : null;
}

/** Retitle in place — the id stays stable so bundles and refs keep working. */
export function renameCollection(id: string, title: string): void {
  const collection = getCollection(id);
  if (!collection || !title.trim()) return;
  saveCollection({ ...collection, title: title.trim() });
}

export function deleteCollection(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function addToCollection(collectionId: string, scenarioId: string): void {
  const collection = getCollection(collectionId);
  if (!collection || collection.scenarioIds.includes(scenarioId)) return;
  saveCollection({ ...collection, scenarioIds: [...collection.scenarioIds, scenarioId] });
}

export function removeFromCollection(collectionId: string, scenarioId: string): void {
  const collection = getCollection(collectionId);
  if (!collection) return;
  saveCollection({
    ...collection,
    scenarioIds: collection.scenarioIds.filter((id) => id !== scenarioId),
  });
}

/** Swap a scenario one slot up (-1) or down (+1) within its collection. */
export function moveInCollection(collectionId: string, scenarioId: string, dir: -1 | 1): void {
  const collection = getCollection(collectionId);
  if (!collection) return;
  const ids = [...collection.scenarioIds];
  const from = ids.indexOf(scenarioId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  saveCollection({ ...collection, scenarioIds: ids });
}
