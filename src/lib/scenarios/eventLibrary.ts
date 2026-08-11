import { z } from 'zod';
import { eventSchema } from '../engine/schema';
import type { ScenarioEvent } from '../engine/types';
import { formatZodIssues } from '../zodIssues';
import { uniquifyId } from './collections';

/**
 * Personal event library — instructor-saved events, reusable across
 * scenarios, plus a one-file JSON format for moving a library between
 * machines. Framework-free (Node-testable) like collections.ts: the
 * localStorage plumbing lives in eventLibraryStore.ts.
 *
 * Distinct from src/lib/engine/eventTemplates.ts on purpose: templates are
 * curated clinical content (values copied verbatim from reviewed bundled
 * scenarios); library entries carry the instructor's own values, saved from
 * events they authored. This module never touches the template registry.
 *
 * Entries strip the scenario-specific event fields (id, autoAtSec,
 * phaseHint, actionIds) — they're meaningless outside the source scenario.
 * Insertion stamps an ordinary blank-id inline event, same rule as
 * templates: the author names it and chooses its trigger.
 */

export interface SavedEvent {
  /** Library-unique slug derived from the label ("brisk-bleeding-2"). */
  id: string;
  label: string;
  description?: string;
  category: ScenarioEvent['category'];
  effects: ScenarioEvent['effects'];
  savedAtIso: string;
}

export type SavedEventPayload = Omit<SavedEvent, 'id' | 'savedAtIso'>;

/** Reuses the runtime event schema so effect validation can never drift. */
export const savedEventPayloadSchema = eventSchema.pick({
  label: true,
  description: true,
  category: true,
  effects: true,
});

export const savedEventSchema = savedEventPayloadSchema.extend({
  id: z.string().min(1),
  savedAtIso: z.string().min(1),
});

/** Extract the library payload from a scenario event: scenario-specific
 *  fields dropped, effects deep-copied so later edits to the source event
 *  never reach the library (and vice versa). */
export function payloadFromEvent(
  event: Pick<ScenarioEvent, 'label' | 'description' | 'category' | 'effects'>,
): SavedEventPayload {
  return {
    label: event.label.trim(),
    ...(event.description ? { description: event.description } : {}),
    category: event.category,
    effects: structuredClone(event.effects),
  };
}

// Canonical form for duplicate detection. Key order is deterministic here;
// effects objects come from the same editor code paths, so re-saving an
// unchanged event always stringifies identically.
function dupKey(p: SavedEventPayload): string {
  return JSON.stringify({
    label: p.label,
    description: p.description ?? '',
    category: p.category,
    effects: p.effects,
  });
}

/** Exact-content duplicate (label, description, category, effects). */
export function isDuplicate(
  payload: SavedEventPayload,
  entries: readonly SavedEvent[],
): boolean {
  const key = dupKey(payload);
  return entries.some((e) => dupKey(e) === key);
}

/** Derive a library id from the label, unique against existing ids. */
export function newSavedEventId(label: string, taken: ReadonlySet<string>): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return uniquifyId(slug || 'event', taken);
}

/** Library size cap. Entries are ~1 KB snippets; the cap exists to keep the
 *  pickers scannable, not to protect storage. */
export const MAX_EVENTS = 100;

const FORMAT_KIND = 'capno-event-library';
const FORMAT_VERSION = 1;

export interface EventLibraryFile {
  kind: typeof FORMAT_KIND;
  formatVersion: typeof FORMAT_VERSION;
  exportedAtIso: string;
  events: SavedEvent[];
}

const libraryFileSchema = z.object({
  kind: z.literal(FORMAT_KIND),
  formatVersion: z.literal(FORMAT_VERSION),
  exportedAtIso: z.string(),
  events: z.array(savedEventSchema),
});

export function serializeLibraryFile(events: readonly SavedEvent[]): string {
  const file: EventLibraryFile = {
    kind: FORMAT_KIND,
    formatVersion: FORMAT_VERSION,
    exportedAtIso: new Date().toISOString(),
    events: [...events],
  };
  return JSON.stringify(file, null, 2);
}

export type ParseLibraryResult =
  | { ok: true; file: EventLibraryFile }
  | { ok: false; errors: string[] };

/** Validates every entry — never trust a file (same stance as cloud pulls).
 *  Accepts raw text or already-parsed JSON. */
export function parseLibraryFile(input: string | unknown): ParseLibraryResult {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }
  const result = libraryFileSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: ['Not a valid Capno event-library file.', ...formatZodIssues(result.error)],
    };
  }
  return { ok: true, file: result.data as EventLibraryFile };
}

export interface LibraryImportPlan {
  /** Entries to prepend, ids remapped where they collided locally. */
  toAdd: SavedEvent[];
  /** Incoming entries content-identical to one already present (or earlier in the file). */
  skippedDuplicates: number;
  /** Non-duplicate entries dropped because the library would exceed MAX_EVENTS. */
  droppedOverCap: number;
}

/** Append-with-dedupe merge: exact-content duplicates are skipped, id
 *  collisions remapped, and anything past the cap dropped (reported, never
 *  silent). */
export function planLibraryImport(
  incoming: readonly SavedEvent[],
  existing: readonly SavedEvent[],
): LibraryImportPlan {
  const taken = new Set(existing.map((e) => e.id));
  const toAdd: SavedEvent[] = [];
  let skippedDuplicates = 0;
  let droppedOverCap = 0;
  for (const entry of incoming) {
    if (isDuplicate(entry, [...existing, ...toAdd])) {
      skippedDuplicates++;
      continue;
    }
    if (existing.length + toAdd.length >= MAX_EVENTS) {
      droppedOverCap++;
      continue;
    }
    const id = uniquifyId(entry.id, taken);
    taken.add(id);
    toAdd.push({ ...entry, id });
  }
  return { toAdd, skippedDuplicates, droppedOverCap };
}
