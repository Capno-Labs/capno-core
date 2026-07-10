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
import { cloudEligible, enqueue, markPushed, registerPushHandler } from './outbox';

/**
 * Scenario cloud sync — mirrors the local head+history model onto the
 * `scenarios` (upsert head) and `scenario_versions` (append) tables.
 *
 * Pulls are on-view and validated with the same zod schema as file imports:
 * never trust the cloud more than a local file. Conflicts are last-writer-
 * wins by timestamp; the losing head is preserved in the local version
 * history (both sides are append-only, so LWW cannot destroy work).
 */

interface PushFailure {
  ok: false;
  permanent: boolean;
  error: string;
}

function classifyError(
  error: { code?: string; message?: string },
  scenarioId: string,
): PushFailure {
  const msg = error.message ?? 'unknown error';
  if (error.code === '42501' || /row-level security/i.test(msg)) {
    return {
      ok: false,
      permanent: true,
      error: `Could not push "${scenarioId}": your account lacks the faculty role, or this scenario id is owned by another faculty member. It remains saved on this device.`,
    };
  }
  return { ok: false, permanent: false, error: msg };
}

async function pushScenarioById(id: string): Promise<{ ok: true } | PushFailure> {
  const supabase = getSupabase();
  const scenario = getCustomScenario(id);
  if (!supabase) return { ok: false, permanent: false, error: 'Supabase unavailable.' };
  if (!scenario) {
    // Deleted locally since it was queued — nothing to push.
    return { ok: false, permanent: true, error: `Scenario "${id}" no longer exists locally.` };
  }
  const uid = useAuthStore.getState().user?.id;
  const { error } = await supabase.from('scenarios').upsert({
    id: scenario.id,
    title: scenario.title,
    definition: scenario,
    owner_id: uid,
    updated_at: new Date().toISOString(),
  });
  if (error) return classifyError(error, id);
  const { error: versionError } = await supabase.from('scenario_versions').insert({
    scenario_id: scenario.id,
    version: scenario.version,
    definition: scenario,
    saved_by: uid,
  });
  if (versionError) return classifyError(versionError, id);
  return { ok: true };
}

registerPushHandler('scenario', pushScenarioById);

export interface CloudScenario {
  scenario: Scenario;
  updatedAtIso: string;
}

/** Fetch all scenarios visible to this account; invalid definitions are skipped. */
export async function pullScenarios(): Promise<CloudScenario[]> {
  const supabase = getSupabase();
  if (!supabase || !cloudEligible()) return [];
  const { data, error } = await supabase.from('scenarios').select('id, definition, updated_at');
  if (error || !data) return [];
  const valid: CloudScenario[] = [];
  for (const row of data) {
    const check = validateScenario(row.definition);
    if (!check.ok) {
      console.warn(`Capno: skipping invalid cloud scenario "${row.id}":`, check.errors);
      continue;
    }
    valid.push({ scenario: parseScenario(row.definition), updatedAtIso: row.updated_at });
  }
  return valid;
}

/**
 * Merge pulled scenarios into local storage. Newer side wins the head;
 * a replaced local head survives in the local version history. Local-only
 * newer edits are re-queued for push.
 */
export function mergeCloudScenarios(pulled: CloudScenario[]): { updated: number } {
  let updated = 0;
  for (const { scenario, updatedAtIso } of pulled) {
    const localHead = getVersionHistory(scenario.id)[0];
    if (!localHead) {
      if (saveCustomScenario(scenario).ok) {
        markPushed('scenario', scenario.id);
        updated += 1;
      }
      continue;
    }
    if (JSON.stringify(localHead.scenario) === JSON.stringify(scenario)) {
      markPushed('scenario', scenario.id);
      continue;
    }
    if (updatedAtIso > localHead.savedAtIso) {
      if (saveCustomScenario(scenario).ok) {
        markPushed('scenario', scenario.id);
        updated += 1;
      }
    } else {
      // Local head is newer than the cloud — push it.
      enqueue('scenario', scenario.id);
    }
  }
  return { updated };
}
