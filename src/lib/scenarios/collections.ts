import { z } from 'zod';
import { scenarioSchema } from '../engine/schema';
import type { Scenario } from '../engine/types';
import { formatZodIssues } from '../zodIssues';
import { QUICK_START_ID } from './quickStart';

/**
 * Scenario collections — named, ordered groupings of scenarios (a program's
 * own library: "CA-1 fall block", "oral boards prep"), plus a one-file JSON
 * bundle format for sharing a collection and its custom scenarios between
 * machines. Framework-free (Node-testable) like sessionExport.ts: the
 * library page does the localStorage/Blob plumbing.
 *
 * A collection stores scenario *ids* only. Built-in scenarios ship in every
 * install, so bundles carry them as bare references; custom scenarios are
 * embedded in full and validated with the runtime scenario schema on import.
 * Ids that resolve nowhere are kept (they may resolve after a later import)
 * and surfaced as "missing" in the UI.
 */

export interface ScenarioCollection {
  id: string;
  title: string;
  description?: string;
  /** Ordered; entries may be built-in ids, custom ids, or unresolved refs. */
  scenarioIds: string[];
  createdAtIso: string;
  updatedAtIso: string;
}

// Mirrors the engine's scenario idSchema pattern (not exported there).
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;

export const collectionSchema = z
  .object({
    id: z.string().min(1).regex(ID_RE, 'lowercase a-z0-9_- starting with a-z0-9'),
    title: z.string().min(1),
    description: z.string().optional(),
    scenarioIds: z.array(z.string().min(1)),
    createdAtIso: z.string().min(1),
    updatedAtIso: z.string().min(1),
  })
  .passthrough();

const FORMAT_KIND = 'capno-collection-bundle';
const FORMAT_VERSION = 1;

export interface CollectionBundle {
  kind: typeof FORMAT_KIND;
  formatVersion: typeof FORMAT_VERSION;
  exportedAtIso: string;
  collection: ScenarioCollection;
  /** Custom scenarios embedded in full; built-ins travel as id references. */
  scenarios: Scenario[];
}

const bundleSchema = z.object({
  kind: z.literal(FORMAT_KIND),
  formatVersion: z.literal(FORMAT_VERSION),
  exportedAtIso: z.string(),
  collection: collectionSchema,
  scenarios: z.array(scenarioSchema),
});

/** Append -2, -3, … until the id is free (bundle imports, AI drafts). */
export function uniquifyId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Derive a collection id from its title, unique against existing ids. */
export function slugifyCollectionId(title: string, taken: ReadonlySet<string>): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return uniquifyId(slug || 'collection', taken);
}

export function serializeCollectionBundle(
  collection: ScenarioCollection,
  customById: ReadonlyMap<string, Scenario>,
): string {
  const bundle: CollectionBundle = {
    kind: FORMAT_KIND,
    formatVersion: FORMAT_VERSION,
    exportedAtIso: new Date().toISOString(),
    collection,
    // Embed every referenced custom scenario — including a custom copy that
    // shadows a built-in id (that copy is the author's intended version).
    scenarios: collection.scenarioIds
      .map((id) => customById.get(id))
      .filter((s): s is Scenario => Boolean(s)),
  };
  return JSON.stringify(bundle, null, 2);
}

export type ParseBundleResult =
  | { ok: true; bundle: CollectionBundle }
  | { ok: false; errors: string[] };

/** Accepts raw file text or already-parsed JSON (import UIs parse once to sniff the kind). */
export function parseCollectionBundle(input: string | unknown): ParseBundleResult {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }
  const result = bundleSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: ['Not a valid Capno collection bundle.', ...formatZodIssues(result.error)],
    };
  }
  return { ok: true, bundle: result.data as unknown as CollectionBundle };
}

/** Is this raw parsed JSON value shaped like a collection bundle? (Cheap sniff for a unified import button — scenario files have no `kind` key.) */
export function looksLikeCollectionBundle(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && (raw as { kind?: unknown }).kind === FORMAT_KIND;
}

export interface BundleImportPlan {
  /** The collection to save — id remapped if it collided locally. */
  collection: ScenarioCollection;
  collectionIdRemapped: boolean;
  /** Embedded scenarios to write via saveCustomScenario, in bundle order. */
  scenariosToSave: Scenario[];
  newScenarioIds: string[];
  /** Already custom locally — the save appends a version, nothing is lost. */
  updatedScenarioIds: string[];
  /** Deep-equal to the current local head — skipped to spare version slots. */
  skippedIdenticalIds: string[];
  /** Referenced ids that resolve nowhere (kept in the collection anyway). */
  missingRefs: string[];
}

export function planBundleImport(
  bundle: CollectionBundle,
  ctx: {
    builtInIds: ReadonlySet<string>;
    customById: ReadonlyMap<string, Scenario>;
    existingCollectionIds: ReadonlySet<string>;
  },
): BundleImportPlan {
  const id = uniquifyId(bundle.collection.id, ctx.existingCollectionIds);
  // Hand-edited/merged bundles may repeat a ref; the UI's remove/reorder
  // controls assume each id appears at most once, so first occurrence wins.
  const scenarioIds = [...new Set(bundle.collection.scenarioIds)];

  const scenariosToSave: Scenario[] = [];
  const newScenarioIds: string[] = [];
  const updatedScenarioIds: string[] = [];
  const skippedIdenticalIds: string[] = [];
  for (const scenario of bundle.scenarios) {
    const local = ctx.customById.get(scenario.id);
    if (local && JSON.stringify(local) === JSON.stringify(scenario)) {
      skippedIdenticalIds.push(scenario.id);
      continue;
    }
    scenariosToSave.push(scenario);
    (local ? updatedScenarioIds : newScenarioIds).push(scenario.id);
  }

  const bundledIds = new Set(bundle.scenarios.map((s) => s.id));
  const missingRefs = scenarioIds.filter(
    (ref) =>
      ref !== QUICK_START_ID &&
      !ctx.builtInIds.has(ref) &&
      !ctx.customById.has(ref) &&
      !bundledIds.has(ref),
  );

  return {
    collection: { ...bundle.collection, id, scenarioIds },
    collectionIdRemapped: id !== bundle.collection.id,
    scenariosToSave,
    newScenarioIds,
    updatedScenarioIds,
    skippedIdenticalIds,
    missingRefs,
  };
}

/** Split a collection's refs into resolvable and missing, preserving order. */
export function resolveRefs(
  scenarioIds: string[],
  resolvable: (id: string) => boolean,
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const id of scenarioIds) (resolvable(id) ? present : missing).push(id);
  return { present, missing };
}
