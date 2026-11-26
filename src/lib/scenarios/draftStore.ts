'use client';

import type { Scenario } from '../engine/types';

/**
 * The editor's working drafts: unsaved edits, kept on this device so a
 * reload, a crash or a wrong click never loses them. A draft is NOT a saved
 * version — it never appears in the library, a session or the cloud until
 * the author presses "Save version" (see customStore.ts), which clears it.
 *
 * Keyed by the case id for a saved case, or `new:<source id>` for a case
 * that has never been saved (ids cannot contain ':', so the two never clash).
 */

const KEY = 'capno:editor-drafts:v1';

export interface ScenarioDraft {
  savedAtIso: string;
  scenario: Scenario;
}

type DraftMap = Record<string, ScenarioDraft>;

/** Draft key for a never-saved case, optionally started from another case. */
export function newDraftKey(fromId?: string | null): string {
  return `new:${fromId ?? ''}`;
}

function readAll(): DraftMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DraftMap) : {};
  } catch {
    return {};
  }
}

function writeAll(drafts: DraftMap): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(drafts));
    return true;
  } catch {
    // Storage full or unavailable — the caller warns before the tab closes.
    return false;
  }
}

export function getDraft(key: string): ScenarioDraft | undefined {
  const draft = readAll()[key];
  // Only hand back something the form can render.
  return draft && typeof draft.scenario === 'object' && draft.scenario !== null && draft.savedAtIso
    ? draft
    : undefined;
}

/** False when the draft could not be written (storage full or blocked). */
export function saveDraft(key: string, scenario: Scenario): boolean {
  if (typeof window === 'undefined') return false;
  return writeAll({ ...readAll(), [key]: { savedAtIso: new Date().toISOString(), scenario } });
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  const drafts = readAll();
  if (!(key in drafts)) return;
  delete drafts[key];
  writeAll(drafts);
}

/** Ids of saved cases that have unsaved edits waiting in the editor. */
export function listDraftCaseIds(): string[] {
  return Object.keys(readAll()).filter((k) => !k.startsWith('new:'));
}
