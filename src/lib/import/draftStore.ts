'use client';

import { validateImportDraft } from './schema';
import type { ImportDraft, ParsedDocument } from './types';

/**
 * Local persistence for in-progress imports: the parsed source (so the
 * side-by-side view survives a reload) and its drafts. Versioned key per
 * CLAUDE.md "Known traps"; drafts are validated on read.
 */

const KEY = 'capno:import-drafts:v1';
const MAX_SOURCES = 10;

export interface StoredImport {
  sourceId: string;
  source: ParsedDocument;
  drafts: ImportDraft[];
  savedAtIso: string;
}

function readAll(): StoredImport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredImport[];
    return parsed.filter((s) => s.drafts.every((d) => validateImportDraft(d).ok));
  } catch {
    return [];
  }
}

function writeAll(items: StoredImport[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function listImports(): StoredImport[] {
  return readAll().sort((a, b) => (a.savedAtIso < b.savedAtIso ? 1 : -1));
}

export function getImport(sourceId: string): StoredImport | undefined {
  return readAll().find((s) => s.sourceId === sourceId);
}

export function saveImport(item: Omit<StoredImport, 'savedAtIso'>): { ok: true } | { ok: false; error: string } {
  const others = readAll().filter((s) => s.sourceId !== item.sourceId);
  const next = [{ ...item, savedAtIso: new Date().toISOString() }, ...others]
    .sort((a, b) => (a.savedAtIso < b.savedAtIso ? 1 : -1))
    .slice(0, MAX_SOURCES);
  return writeAll(next)
    ? { ok: true }
    : { ok: false, error: 'Could not save the import — device storage may be full.' };
}

export function saveDraft(draft: ImportDraft): { ok: true } | { ok: false; error: string } {
  const item = getImport(draft.sourceId);
  if (!item) return { ok: false, error: 'The source for this draft is no longer stored on this device.' };
  const drafts = item.drafts.some((d) => d.draftId === draft.draftId)
    ? item.drafts.map((d) => (d.draftId === draft.draftId ? draft : d))
    : [...item.drafts, draft];
  return saveImport({ sourceId: item.sourceId, source: item.source, drafts });
}

export function deleteImport(sourceId: string): void {
  writeAll(readAll().filter((s) => s.sourceId !== sourceId));
}
