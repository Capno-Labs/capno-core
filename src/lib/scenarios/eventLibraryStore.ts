'use client';

import {
  MAX_EVENTS,
  isDuplicate,
  newSavedEventId,
  planLibraryImport,
  type SavedEvent,
  type SavedEventPayload,
} from './eventLibrary';

/**
 * Local persistence for the personal event library. Mirrors
 * collectionStore.ts: no per-entry version history (entries are small
 * snippets, not documents), no migrateLegacyKey (no labsim:* ancestor).
 *
 * This store is the only localStorage toucher for the library, and reads
 * are whole-list — the hosted layer can build institutional/shared
 * libraries by reusing eventLibrary.ts (shapes, schema, file format, merge
 * planning) server-side and treating this module as the swappable
 * persistence edge (e.g. a future cloud outbox kind 'saved-event' re-reads
 * current state at push time with no reshaping).
 */

const KEY = 'capno:event-library:v1';

function readAll(): SavedEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: SavedEvent[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch {
    // Storage full or unavailable.
    return false;
  }
}

/** Newest first (entries are prepended on save). */
export function listSavedEvents(): SavedEvent[] {
  return readAll();
}

export type SaveToLibraryResult =
  | { ok: true; entry: SavedEvent }
  | { ok: false; error: string; duplicate?: boolean };

export function saveEventToLibrary(payload: SavedEventPayload): SaveToLibraryResult {
  const entries = readAll();
  if (isDuplicate(payload, entries)) {
    return { ok: false, duplicate: true, error: 'Already in your library.' };
  }
  if (entries.length >= MAX_EVENTS) {
    return {
      ok: false,
      error: `Your event library is full (${MAX_EVENTS} entries) — delete or export entries first.`,
    };
  }
  const entry: SavedEvent = {
    id: newSavedEventId(payload.label, new Set(entries.map((e) => e.id))),
    ...payload,
    savedAtIso: new Date().toISOString(),
  };
  if (writeAll([entry, ...entries])) return { ok: true, entry };
  // A flat library has nothing safe to auto-prune — never silently delete
  // user-authored entries (contrast customStore's version-history pruning).
  return {
    ok: false,
    error:
      'Device storage is full — the event was NOT saved. Export your library, free space (delete old sessions or scenarios), and try again.',
  };
}

export function deleteSavedEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

export type ImportLibraryResult =
  | { ok: true; added: number; skippedDuplicates: number; droppedOverCap: number }
  | { ok: false; error: string };

/** Merge validated file entries in (see planLibraryImport for semantics). */
export function importSavedEvents(incoming: SavedEvent[]): ImportLibraryResult {
  const existing = readAll();
  const plan = planLibraryImport(incoming, existing);
  const counts = {
    added: plan.toAdd.length,
    skippedDuplicates: plan.skippedDuplicates,
    droppedOverCap: plan.droppedOverCap,
  };
  if (plan.toAdd.length === 0) return { ok: true, ...counts };
  if (writeAll([...plan.toAdd, ...existing])) return { ok: true, ...counts };
  return {
    ok: false,
    error: 'Device storage is full — nothing was imported. Free space and try again.',
  };
}
