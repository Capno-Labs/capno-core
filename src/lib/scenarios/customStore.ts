'use client';

import type { Scenario } from '../engine/types';
import { migrateLegacyKey } from '../legacyStorage';

/**
 * Custom (faculty-authored) scenarios, persisted in localStorage with a
 * simple linear version history per scenario id. The editor writes here;
 * the library and controller read from here + the built-in registry.
 */

const KEY = 'capno:custom-scenarios:v1';
const MAX_VERSIONS = 20;

export interface ScenarioVersion {
  savedAtIso: string;
  scenario: Scenario;
}

interface CustomScenarioRecord {
  id: string;
  versions: ScenarioVersion[]; // newest first
}

function readAll(): CustomScenarioRecord[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyKey(KEY);
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomScenarioRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CustomScenarioRecord[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
    return true;
  } catch {
    // Storage full or unavailable.
    return false;
  }
}

export function listCustomScenarios(): Scenario[] {
  return readAll()
    .map((r) => r.versions[0]?.scenario)
    .filter((s): s is Scenario => Boolean(s));
}

export function getCustomScenario(id: string): Scenario | undefined {
  return readAll().find((r) => r.id === id)?.versions[0]?.scenario;
}

export function getVersionHistory(id: string): ScenarioVersion[] {
  return readAll().find((r) => r.id === id)?.versions ?? [];
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export function saveCustomScenario(scenario: Scenario): SaveResult {
  const records = readAll();
  const version: ScenarioVersion = { savedAtIso: new Date().toISOString(), scenario };
  const existing = records.find((r) => r.id === scenario.id);
  if (existing) {
    existing.versions = [version, ...existing.versions].slice(0, MAX_VERSIONS);
  } else {
    records.push({ id: scenario.id, versions: [version] });
  }
  if (writeAll(records)) return { ok: true };
  // Storage full — version history is the bulk; prune every scenario to its
  // newest 3 versions and retry once before giving up.
  for (const r of records) r.versions = r.versions.slice(0, 3);
  if (writeAll(records)) return { ok: true };
  return {
    ok: false,
    error:
      'Device storage is full — the scenario was NOT saved. Export it as JSON now, then free space (delete old sessions or scenarios) and save again.',
  };
}

export function deleteCustomScenario(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
