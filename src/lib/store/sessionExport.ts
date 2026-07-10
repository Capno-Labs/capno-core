import { z } from 'zod';
import { scenarioSchema } from '../engine/schema';
import type { ArchivedSession } from '../engine/types';

/**
 * Session archive export/import — a JSON file format for backing up debriefs
 * and moving them between machines. Framework-free (Node-testable): the
 * debrief pages do the Blob/file plumbing.
 *
 * The embedded scenario is validated with the full runtime schema; the
 * snapshot/score/history are checked structurally only (required keys and
 * types), with unknown keys passed through so files survive future additive
 * fields.
 */

const FORMAT_KIND = 'capno-session-export';
/** Pre-rename kind — still accepted on import so old backup files keep working. */
const LEGACY_FORMAT_KIND = 'labsim-session-export';
const FORMAT_VERSION = 1;

const snapshotSchema = z
  .object({
    scenarioId: z.string(),
    sessionId: z.string(),
    status: z.string(),
    elapsedSec: z.number(),
    phaseId: z.string(),
    vitals: z.object({}).passthrough(),
    nibp: z.object({ sbp: z.number(), dbp: z.number(), atSec: z.number() }).nullable(),
    alarms: z.array(z.object({}).passthrough()),
    alarmsSilenced: z.boolean(),
    actions: z.array(z.object({ actionId: z.string(), status: z.string() }).passthrough()),
    log: z.array(z.object({}).passthrough()),
    notes: z.array(z.object({}).passthrough()),
    firedEventIds: z.array(z.string()),
  })
  .passthrough();

const scoreSchema = z
  .object({
    earned: z.number(),
    possible: z.number(),
    percent: z.number(),
    categories: z.array(z.object({}).passthrough()),
    criticalMissed: z.array(z.object({}).passthrough()),
    criticalDone: z.array(z.object({}).passthrough()),
  })
  .passthrough();

const archivedSessionSchema = z
  .object({
    sessionId: z.string().min(1),
    scenario: scenarioSchema,
    snapshot: snapshotSchema,
    endedAtIso: z.string().min(1),
    score: scoreSchema,
    history: z
      .array(z.object({ t: z.number() }).passthrough())
      .optional(),
    learnerNames: z.array(z.string()).optional(),
  })
  .passthrough();

/** Validate one ArchivedSession-shaped value (also used for cloud fetches). */
export function validateArchivedSession(
  raw: unknown,
): { ok: true; session: ArchivedSession } | { ok: false; errors: string[] } {
  const result = archivedSessionSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues
        .slice(0, 10)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  return { ok: true, session: result.data as unknown as ArchivedSession };
}

const exportEnvelopeSchema = z.object({
  kind: z.union([z.literal(FORMAT_KIND), z.literal(LEGACY_FORMAT_KIND)]),
  formatVersion: z.literal(FORMAT_VERSION),
  exportedAtIso: z.string(),
  sessions: z.array(archivedSessionSchema).min(1),
});

export function serializeSessions(sessions: ArchivedSession[]): string {
  return JSON.stringify(
    {
      kind: FORMAT_KIND,
      formatVersion: FORMAT_VERSION,
      exportedAtIso: new Date().toISOString(),
      sessions,
    },
    null,
    2,
  );
}

export type ParseExportResult =
  | { ok: true; sessions: ArchivedSession[] }
  | { ok: false; errors: string[] };

export function parseSessionExport(text: string): ParseExportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const result = exportEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { ok: false, errors: [`Not a valid Capno session export.`, ...errors] };
  }
  return { ok: true, sessions: result.data.sessions as unknown as ArchivedSession[] };
}

const MAX_SESSIONS = 50;

export interface MergeResult {
  merged: ArchivedSession[];
  added: number;
  skipped: number;
}

/**
 * Merge imported sessions into the existing archive. The device that ran a
 * session is authoritative: on sessionId collision the existing local record
 * wins. Result is newest-first and capped, preferring local entries.
 */
export function mergeImported(
  existing: ArchivedSession[],
  imported: ArchivedSession[],
): MergeResult {
  const localIds = new Set(existing.map((s) => s.sessionId));
  const seen = new Set<string>();
  const fresh: ArchivedSession[] = [];
  let skipped = 0;
  for (const s of imported) {
    if (localIds.has(s.sessionId) || seen.has(s.sessionId)) {
      skipped += 1;
      continue;
    }
    seen.add(s.sessionId);
    fresh.push(s);
  }
  // Local entries always survive the cap; imported ones fill remaining slots.
  const slots = Math.max(0, MAX_SESSIONS - existing.length);
  const admitted = fresh
    .sort((a, b) => (a.endedAtIso < b.endedAtIso ? 1 : a.endedAtIso > b.endedAtIso ? -1 : 0))
    .slice(0, slots);
  const merged = [...existing, ...admitted].sort((a, b) =>
    a.endedAtIso < b.endedAtIso ? 1 : a.endedAtIso > b.endedAtIso ? -1 : 0,
  );
  return { merged, added: admitted.length, skipped: skipped + (fresh.length - admitted.length) };
}
