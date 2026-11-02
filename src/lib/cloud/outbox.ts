'use client';

import { isCloudFaculty, onSignedIn } from './authStore';
import { supabaseConfigured } from '../sync/supabase';
import { migrateLegacyKey } from '../legacyStorage';

/**
 * Cloud push outbox — offline-first write-through queue.
 *
 * Local writes (localStorage) always happen first and are authoritative on
 * this device; cloud pushes are queued here and drained opportunistically
 * (app load, sign-in, after each enqueue). Ops reference ids only — the
 * drain re-reads the current local data at push time, so a scenario edited
 * three times while offline pushes once, with the latest state.
 *
 * Permission failures (RLS: account lacks the faculty role, or the scenario
 * id belongs to another owner) drop the op with a message; network failures
 * keep it queued for the next drain.
 */

const OUTBOX_KEY = 'capno:cloud-outbox:v1';
const SYNC_META_KEY = 'capno:cloud-sync-meta:v1';

export type OutboxKind = 'scenario' | 'session';

export interface OutboxOp {
  kind: OutboxKind;
  id: string;
  queuedAtIso: string;
  attempts: number;
}

/** Review state of a cloud scenario head (mirrors `scenarios.status`). */
export type CloudScenarioStatus = 'draft' | 'review' | 'published';

export function isCloudScenarioStatus(value: unknown): value is CloudScenarioStatus {
  return value === 'draft' || value === 'review' || value === 'published';
}

/**
 * Per-(kind,id) sync bookkeeping. Scenario entries additionally remember what
 * the cloud knows about the head, so a run can pin its archive to the exact
 * version row and the editor can show review state offline. All fields after
 * `pushedAtIso` are additive (same `capno:cloud-sync-meta:v1` key; older
 * entries simply lack them).
 */
export interface SyncMetaEntry {
  pushedAtIso: string;
  /** Scenario: id of the `scenario_versions` row the cloud head currently equals. */
  cloudVersionId?: number;
  /** Scenario: `savedAtIso` of the local head when `cloudVersionId` was recorded. */
  pushedSavedAtIso?: string;
  /** Scenario: review state of the cloud head as last seen. */
  cloudStatus?: CloudScenarioStatus;
}

type SyncMeta = Record<string, SyncMetaEntry>;

export type SyncMetaPatch = Partial<Omit<SyncMetaEntry, 'pushedAtIso'>>;

/** Executes one push. Registered by scenarioCloud/sessionCloud to avoid import cycles. */
export type PushHandler = (
  id: string,
) => Promise<{ ok: true } | { ok: false; permanent: boolean; error: string }>;

const pushHandlers = new Map<OutboxKind, PushHandler>();

export function registerPushHandler(kind: OutboxKind, handler: PushHandler): void {
  pushHandlers.set(kind, handler);
}

function readOutbox(): OutboxOp[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyKey(OUTBOX_KEY);
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(ops: OutboxOp[]): void {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  } catch {
    // Storage full — the queue is reconstructible (drain re-reads local data),
    // so losing it degrades to "push again on next save", not data loss.
  }
}

function readSyncMeta(): SyncMeta {
  if (typeof window === 'undefined') return {};
  migrateLegacyKey(SYNC_META_KEY);
  try {
    const raw = window.localStorage.getItem(SYNC_META_KEY);
    return raw ? (JSON.parse(raw) as SyncMeta) : {};
  } catch {
    return {};
  }
}

function writeSyncMeta(meta: SyncMeta): void {
  try {
    window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Badges degrade to "pending"; harmless.
  }
}

function metaKey(kind: OutboxKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Record a successful push. Existing bookkeeping (version id, review state)
 * survives unless `patch` overrides it — drain calls this with no patch right
 * after a handler that may already have recorded the version it pushed.
 */
export function markPushed(kind: OutboxKind, id: string, patch: SyncMetaPatch = {}): void {
  const meta = readSyncMeta();
  const key = metaKey(kind, id);
  meta[key] = { ...meta[key], ...patch, pushedAtIso: new Date().toISOString() };
  writeSyncMeta(meta);
}

export function getPushedAt(kind: OutboxKind, id: string): string | null {
  return readSyncMeta()[metaKey(kind, id)]?.pushedAtIso ?? null;
}

export function getSyncMeta(kind: OutboxKind, id: string): SyncMetaEntry | null {
  return readSyncMeta()[metaKey(kind, id)] ?? null;
}

/**
 * The cloud version row a run of this scenario should pin to, or null when
 * the cloud copy may differ from the local head (never pushed, edited since
 * the last push, or a push still queued). `headSavedAtIso` is the local head's
 * `savedAtIso`; the pin is only trusted when it matches the push record.
 */
export function pinnedVersionId(scenarioId: string, headSavedAtIso: string | undefined): number | null {
  const entry = getSyncMeta('scenario', scenarioId);
  if (!entry || entry.cloudVersionId === undefined) return null;
  if (!headSavedAtIso || entry.pushedSavedAtIso !== headSavedAtIso) return null;
  if (isQueued('scenario', scenarioId)) return null;
  return entry.cloudVersionId;
}

export function isQueued(kind: OutboxKind, id: string): boolean {
  return readOutbox().some((op) => op.kind === kind && op.id === id);
}

/** Cloud pushes apply only when configured AND signed in as faculty/admin. */
export function cloudEligible(): boolean {
  return supabaseConfigured() && isCloudFaculty();
}

export function enqueue(kind: OutboxKind, id: string): void {
  const ops = readOutbox();
  if (ops.some((op) => op.kind === kind && op.id === id)) return; // dedupe by (kind,id)
  ops.push({ kind, id, queuedAtIso: new Date().toISOString(), attempts: 0 });
  writeOutbox(ops);
}

export interface DrainResult {
  pushed: number;
  failed: number;
  /** Human-readable messages for permanently dropped ops. */
  dropped: string[];
}

let draining = false;

// Queued ops from a previous offline period drain when the user signs in.
onSignedIn(() => {
  void drain();
});

export async function drain(): Promise<DrainResult> {
  const result: DrainResult = { pushed: 0, failed: 0, dropped: [] };
  if (draining || !cloudEligible()) return result;
  draining = true;
  try {
    const remaining: OutboxOp[] = [];
    for (const op of readOutbox()) {
      const handler = pushHandlers.get(op.kind);
      if (!handler) {
        remaining.push(op);
        continue;
      }
      try {
        const pushed = await handler(op.id);
        if (pushed.ok) {
          markPushed(op.kind, op.id);
          result.pushed += 1;
        } else if (pushed.permanent) {
          result.dropped.push(pushed.error);
        } else {
          result.failed += 1;
          remaining.push({ ...op, attempts: op.attempts + 1 });
        }
      } catch (e) {
        // Network or unexpected error — keep queued.
        result.failed += 1;
        remaining.push({ ...op, attempts: op.attempts + 1 });
        void e;
      }
    }
    writeOutbox(remaining);
  } finally {
    draining = false;
  }
  return result;
}
