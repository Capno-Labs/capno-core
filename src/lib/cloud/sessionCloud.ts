'use client';

import type { ArchivedSession } from '../engine/types';
import { getSession } from '../store/sessionArchive';
import { validateArchivedSession } from '../store/sessionExport';
import { getSupabase } from '../sync/supabase';
import { useAuthStore } from './authStore';
import { cloudEligible, getPushedAt, registerPushHandler } from './outbox';

/**
 * Session cloud sync — pushes archived debriefs to the `sessions` table.
 *
 * Cloud sessions are deliberately NOT merged into the capped local archive
 * (auto-pull could evict unsynced local sessions); the debrief list shows an
 * "Institution archive" section fetched live instead. The device that ran a
 * session stays authoritative; the cloud is the durable superset.
 *
 * Cloud row ids are `<sessionId>-<endedAtIso>`: 4-char codes recycle, so the
 * bare code would collide institution-wide over time. The suffix keeps the
 * id deterministic, making re-pushes (debrief amendments) idempotent upserts.
 */

function cloudRowId(a: ArchivedSession): string {
  return `${a.sessionId}-${a.endedAtIso}`;
}

interface PushFailure {
  ok: false;
  permanent: boolean;
  error: string;
}

function classifyError(error: { code?: string; message?: string }, id: string): PushFailure {
  const msg = error.message ?? 'unknown error';
  if (error.code === '42501' || /row-level security/i.test(msg)) {
    return {
      ok: false,
      permanent: true,
      error: `Could not push session ${id}: your account lacks the faculty role. The debrief remains on this device.`,
    };
  }
  return { ok: false, permanent: false, error: msg };
}

async function pushSessionById(sessionId: string): Promise<{ ok: true } | PushFailure> {
  const supabase = getSupabase();
  const session = getSession(sessionId);
  if (!supabase) return { ok: false, permanent: false, error: 'Supabase unavailable.' };
  if (!session) {
    return {
      ok: false,
      permanent: true,
      error: `Session ${sessionId} no longer exists on this device.`,
    };
  }
  const uid = useAuthStore.getState().user?.id;
  // scenario_id only when the scenario row is known to exist (FK); the frozen
  // scenario_snapshot preserves the full definition either way.
  const scenarioPushed = Boolean(getPushedAt('scenario', session.scenario.id));
  const { error } = await supabase.from('sessions').upsert({
    id: cloudRowId(session),
    scenario_id: scenarioPushed ? session.scenario.id : null,
    scenario_snapshot: session.scenario,
    sim_snapshot: session.snapshot,
    score: session.score,
    history: session.history ?? null,
    faculty_id: uid,
    learner_names: session.learnerNames ?? [],
    ended_at: session.endedAtIso,
  });
  if (error) return classifyError(error, sessionId);
  return { ok: true };
}

registerPushHandler('session', pushSessionById);

export interface CloudSessionSummary {
  cloudId: string;
  title: string;
  percent: number;
  endedAtIso: string;
  learnerNames: string[];
}

/** Light projection for the "Institution archive" list. */
export async function listCloudSessions(): Promise<CloudSessionSummary[]> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select('id, scenario_snapshot->>title, score->>percent, ended_at, learner_names')
    .order('ended_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    cloudId: String(row.id),
    title: String(row.title ?? 'Untitled scenario'),
    percent: Number(row.percent ?? 0),
    endedAtIso: String(row.ended_at ?? ''),
    learnerNames: Array.isArray(row.learner_names) ? (row.learner_names as string[]) : [],
  }));
}

/** Full fetch for the read-only cloud debrief view. Rendered from memory only. */
export async function fetchCloudSession(cloudId: string): Promise<ArchivedSession | null> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) return null;
  const { data, error } = await supabase
    .from('sessions')
    .select('id, scenario_snapshot, sim_snapshot, score, history, learner_names, ended_at')
    .eq('id', cloudId)
    .single();
  if (error || !data) return null;
  const candidate = {
    sessionId: String((data.sim_snapshot as { sessionId?: string })?.sessionId ?? data.id),
    scenario: data.scenario_snapshot,
    snapshot: data.sim_snapshot,
    endedAtIso: String(data.ended_at),
    score: data.score,
    ...(data.history ? { history: data.history } : {}),
    ...(Array.isArray(data.learner_names) && data.learner_names.length > 0
      ? { learnerNames: data.learner_names }
      : {}),
  };
  const check = validateArchivedSession(candidate);
  if (!check.ok) {
    console.warn(`Capno: cloud session ${cloudId} failed validation:`, check.errors);
    return null;
  }
  return check.session;
}
