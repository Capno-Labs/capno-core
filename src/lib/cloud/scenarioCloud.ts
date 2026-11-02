'use client';

import { validateScenario, parseScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';
import {
  getCustomScenario,
  getVersionHistory,
  saveCustomScenario,
} from '../scenarios/customStore';
import { getSupabase } from '../sync/supabase';
import { useAuthStore } from './authStore';
import {
  cloudEligible,
  enqueue,
  isCloudScenarioStatus,
  markPushed,
  registerPushHandler,
  type CloudScenarioStatus,
  type SyncMetaPatch,
} from './outbox';

/**
 * Scenario cloud sync — mirrors the local head+history model onto the
 * `scenarios` (upsert head) and `scenario_versions` (append) tables.
 *
 * Pulls are on-view and validated with the same zod schema as file imports:
 * never trust the cloud more than a local file. Conflicts are last-writer-
 * wins by timestamp; the losing head is preserved in the local version
 * history (both sides are append-only, so LWW cannot destroy work). A
 * `published` cloud head wins exact timestamp ties — a stale device must not
 * silently demote an approved scenario.
 *
 * Review state (`scenarios.status`, `approved_version_id`) is owned by the
 * database trigger `scenarios_review_guard` (db/migrations/0004). The head
 * upsert deliberately never names `status` or `approved_*`: an unchanged
 * client keeps working, and editing a published head demotes it to a draft
 * server-side. Approval is a separate explicit update (`approveScenario`).
 */

interface PushFailure {
  ok: false;
  permanent: boolean;
  error: string;
}

/** Shown when the database refuses an approval (errcode 42501). */
export const APPROVAL_DENIED_MESSAGE =
  "Your account can't approve scenarios in this organization";

function classifyError(
  error: { code?: string; message?: string },
  scenarioId: string,
  permanentMessage = `Could not push "${scenarioId}": your account lacks the faculty role, or this scenario id is owned by another faculty member. It remains saved on this device.`,
): PushFailure {
  const msg = error.message ?? 'unknown error';
  if (error.code === '42501' || /row-level security/i.test(msg)) {
    return { ok: false, permanent: true, error: permanentMessage };
  }
  return { ok: false, permanent: false, error: msg };
}

async function pushScenarioById(
  id: string,
): Promise<{ ok: true; versionId: number } | PushFailure> {
  const supabase = getSupabase();
  const head = getVersionHistory(id)[0];
  const scenario = head?.scenario ?? getCustomScenario(id);
  if (!supabase) return { ok: false, permanent: false, error: 'Supabase unavailable.' };
  if (!scenario) {
    // Deleted locally since it was queued — nothing to push.
    return { ok: false, permanent: true, error: `Scenario "${id}" no longer exists locally.` };
  }
  const uid = useAuthStore.getState().user?.id;
  // Never name status / approved_* here (see module comment).
  const { error } = await supabase.from('scenarios').upsert({
    id: scenario.id,
    title: scenario.title,
    definition: scenario,
    owner_id: uid,
    updated_at: new Date().toISOString(),
  });
  if (error) return classifyError(error, id);
  const { data: version, error: versionError } = await supabase
    .from('scenario_versions')
    .insert({
      scenario_id: scenario.id,
      version: scenario.version,
      definition: scenario,
      saved_by: uid,
    })
    .select('id')
    .single();
  if (versionError) return classifyError(versionError, id);
  const versionId = Number(version.id);
  // The trigger may have demoted a published head we just edited; read back
  // the review state so the editor pill is right. Failure here (e.g. a
  // self-hosted DB without migration 0004) only leaves the state unknown.
  const { data: headRow } = await supabase
    .from('scenarios')
    .select('status')
    .eq('id', scenario.id)
    .maybeSingle();
  markPushed('scenario', id, {
    cloudVersionId: versionId,
    pushedSavedAtIso: head?.savedAtIso,
    cloudStatus: isCloudScenarioStatus(headRow?.status) ? headRow.status : undefined,
  });
  return { ok: true, versionId };
}

registerPushHandler('scenario', pushScenarioById);

export interface CloudScenario {
  scenario: Scenario;
  updatedAtIso: string;
  /** Review state of the cloud head; absent when the row predates migration 0004. */
  status?: CloudScenarioStatus;
  /** Pinned version when `status` is 'published'. */
  approvedVersionId?: number;
}

/** Fetch all scenarios visible to this account; invalid definitions are skipped. */
export async function pullScenarios(): Promise<CloudScenario[]> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) return [];
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, definition, updated_at, status, approved_version_id');
  if (error || !data) return [];
  const valid: CloudScenario[] = [];
  for (const row of data) {
    const check = validateScenario(row.definition);
    if (!check.ok) {
      console.warn(`Capno: skipping invalid cloud scenario "${row.id}":`, check.errors);
      continue;
    }
    const entry: CloudScenario = {
      scenario: parseScenario(row.definition),
      updatedAtIso: row.updated_at,
    };
    if (isCloudScenarioStatus(row.status)) entry.status = row.status;
    if (typeof row.approved_version_id === 'number') {
      entry.approvedVersionId = row.approved_version_id;
    }
    valid.push(entry);
  }
  return valid;
}

/** What the sync meta should remember about a cloud head the local head now equals. */
function metaFor(pulled: CloudScenario, headSavedAtIso: string | undefined): SyncMetaPatch {
  const patch: SyncMetaPatch = { cloudStatus: pulled.status };
  // Only a published head tells us which version row it equals (the trigger
  // guarantees approved_version_id matches the head). Drafts keep whatever
  // version id a previous push recorded, if the head is unchanged.
  if (pulled.status === 'published' && pulled.approvedVersionId !== undefined) {
    patch.cloudVersionId = pulled.approvedVersionId;
    patch.pushedSavedAtIso = headSavedAtIso;
  }
  return patch;
}

/**
 * Merge pulled scenarios into local storage. Newer side wins the head;
 * a replaced local head survives in the local version history. Local-only
 * newer edits are re-queued for push. A published cloud head wins ties.
 */
export function mergeCloudScenarios(pulled: CloudScenario[]): { updated: number } {
  let updated = 0;
  for (const entry of pulled) {
    const { scenario, updatedAtIso } = entry;
    const localHead = getVersionHistory(scenario.id)[0];
    const adopt = (): void => {
      if (saveCustomScenario(scenario).ok) {
        markPushed('scenario', scenario.id, metaFor(entry, getVersionHistory(scenario.id)[0]?.savedAtIso));
        updated += 1;
      }
    };
    if (!localHead) {
      adopt();
      continue;
    }
    if (JSON.stringify(localHead.scenario) === JSON.stringify(scenario)) {
      markPushed('scenario', scenario.id, metaFor(entry, localHead.savedAtIso));
      continue;
    }
    const cloudNewer = updatedAtIso > localHead.savedAtIso;
    const publishedTie = updatedAtIso === localHead.savedAtIso && entry.status === 'published';
    if (cloudNewer || publishedTie) {
      adopt();
    } else {
      // Local head is newer than the cloud — push it.
      enqueue('scenario', scenario.id);
    }
  }
  return { updated };
}

export type ApproveResult = { ok: true; versionId: number } | PushFailure;

/**
 * Approve and publish the local head of a scenario: push it (so a version row
 * equal to the head exists), then pin that version as approved. The database
 * trigger checks the approver's permission and the pin; a refusal comes back
 * as a permanent failure carrying APPROVAL_DENIED_MESSAGE.
 */
export async function approveScenario(id: string): Promise<ApproveResult> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) {
    return { ok: false, permanent: false, error: 'Sign in with a faculty account to approve.' };
  }
  const pushed = await pushScenarioById(id);
  if (!pushed.ok) return pushed;
  const { data, error } = await supabase
    .from('scenarios')
    .update({ status: 'published', approved_version_id: pushed.versionId })
    .eq('id', id)
    .select('status');
  if (error) return classifyError(error, id, APPROVAL_DENIED_MESSAGE);
  // RLS filters rows it will not let us update instead of erroring.
  if (!data || data.length === 0) {
    return { ok: false, permanent: true, error: APPROVAL_DENIED_MESSAGE };
  }
  markPushed('scenario', id, { cloudStatus: 'published', cloudVersionId: pushed.versionId });
  return { ok: true, versionId: pushed.versionId };
}

/**
 * Refresh the remembered review state of one scenario from the cloud (editor
 * on open). Returns the status, or null when unknown / not eligible.
 */
export async function refreshScenarioStatus(id: string): Promise<CloudScenarioStatus | null> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) return null;
  const { data, error } = await supabase
    .from('scenarios')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (error || !data || !isCloudScenarioStatus(data.status)) return null;
  markPushed('scenario', id, { cloudStatus: data.status });
  return data.status;
}
