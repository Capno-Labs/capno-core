'use client';

import type { ArchivedSession } from '../engine/types';
import { migrateLegacyKey } from '../legacyStorage';

/**
 * Session archive — completed sessions saved for debriefing.
 *
 * MVP persistence is localStorage on the faculty device: it works offline,
 * needs no account, and debriefs typically happen minutes after the scenario
 * on the same machine. The ArchivedSession shape maps 1:1 onto the
 * `sessions` table in db/schema.sql for institutions running Supabase.
 *
 * Quota handling: localStorage writes can fail (~5 MB ceiling, and archived
 * sessions embed the full snapshot + vitals history). A failed write retries
 * with progressively pruned data, and as a last resort the new session is
 * parked in an in-memory fallback so the debrief that immediately follows a
 * session still renders — callers surface that state to the faculty.
 */

const KEY = 'capno:sessions:v1';
const MAX_SESSIONS = 50;

/**
 * Progressively smaller candidate lists to retry a quota-failed write with.
 * Pure so it can be unit-tested in Node. Sessions must be newest-first.
 */
export function quotaFallbacks(sessions: ArchivedSession[]): ArchivedSession[][] {
  const stripHistory = (list: ArchivedSession[], keepNewest: number): ArchivedSession[] =>
    list.map((s, i) => {
      if (i < keepNewest || !('history' in s) || s.history === undefined) return s;
      const { history: _history, ...rest } = s;
      return rest;
    });
  const capped = sessions.slice(0, MAX_SESSIONS);
  return [
    capped,
    // History (10-second vitals samples) is the bulk of a record — drop it
    // from older sessions first; recent debriefs keep their trend strips.
    stripHistory(capped, 10),
    stripHistory(capped.slice(0, 25), 1),
  ];
}

/** Sessions that could not be persisted this page load (storage full). */
let memoryFallback: ArchivedSession[] = [];

function readStored(): ArchivedSession[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyKey(KEY);
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ArchivedSession[]) : [];
  } catch {
    return [];
  }
}

function readAll(): ArchivedSession[] {
  const stored = readStored();
  if (memoryFallback.length === 0) return stored;
  const memoryIds = new Set(memoryFallback.map((s) => s.sessionId));
  return [...memoryFallback, ...stored.filter((s) => !memoryIds.has(s.sessionId))];
}

function writeAll(sessions: ArchivedSession[]): boolean {
  for (const candidate of quotaFallbacks(sessions)) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(candidate));
      return true;
    } catch {
      // Storage full or unavailable — retry with the next, smaller candidate.
    }
  }
  return false;
}

export interface ArchiveResult {
  ok: boolean;
  /** True when the session only exists in memory and dies with the tab. */
  memoryOnly: boolean;
}

export function archiveSession(session: ArchivedSession): ArchiveResult {
  memoryFallback = memoryFallback.filter((s) => s.sessionId !== session.sessionId);
  const rest = readStored().filter((s) => s.sessionId !== session.sessionId);
  if (writeAll([session, ...rest])) return { ok: true, memoryOnly: false };
  memoryFallback = [session, ...memoryFallback];
  return { ok: false, memoryOnly: true };
}

export function listSessions(): ArchivedSession[] {
  return readAll();
}

/** Replace the whole archive (import flow). Returns false when storage is full. */
export function replaceAllSessions(sessions: ArchivedSession[]): boolean {
  const ok = writeAll(sessions);
  if (ok) {
    const persisted = new Set(sessions.map((s) => s.sessionId));
    memoryFallback = memoryFallback.filter((s) => !persisted.has(s.sessionId));
  }
  return ok;
}

export function getSession(sessionId: string): ArchivedSession | undefined {
  return readAll().find((s) => s.sessionId === sessionId);
}

/** True when this session survived only in the in-memory fallback. */
export function isMemoryOnly(sessionId: string): boolean {
  return memoryFallback.some((s) => s.sessionId === sessionId);
}

export function deleteSession(sessionId: string): void {
  memoryFallback = memoryFallback.filter((s) => s.sessionId !== sessionId);
  writeAll(readStored().filter((s) => s.sessionId !== sessionId));
}

/**
 * Amend an archived session (post-hoc action re-marking, learner names).
 * Returns the updated record, or undefined if the session is not on this device.
 */
export function updateSession(
  sessionId: string,
  patch: Partial<ArchivedSession>,
): ArchivedSession | undefined {
  const memIdx = memoryFallback.findIndex((s) => s.sessionId === sessionId);
  if (memIdx !== -1) {
    const updated = { ...memoryFallback[memIdx], ...patch, sessionId };
    memoryFallback[memIdx] = updated;
    return updated;
  }
  const sessions = readStored();
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx === -1) return undefined;
  const updated = { ...sessions[idx], ...patch, sessionId };
  sessions[idx] = updated;
  if (!writeAll(sessions)) {
    // Persisting the amendment failed — keep it in memory rather than lose it.
    memoryFallback = [updated, ...memoryFallback];
  }
  return updated;
}
