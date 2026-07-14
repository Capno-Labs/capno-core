import { describe, expect, it } from 'vitest';
import type { Scenario } from '../engine/types';
import {
  type CollectionBundle,
  type ScenarioCollection,
  looksLikeCollectionBundle,
  parseCollectionBundle,
  planBundleImport,
  resolveRefs,
  serializeCollectionBundle,
  slugifyCollectionId,
} from './collections';
import { QUICK_START_ID } from './quickStart';
import { BUILT_IN_SCENARIOS } from './registry';

const BUILT_IN = BUILT_IN_SCENARIOS[0];
const BUILT_IN_IDS = new Set(BUILT_IN_SCENARIOS.map((s) => s.id));

/** Deep-cloned valid scenario with a custom id. */
function customScenario(id: string, overrides?: Partial<Scenario>): Scenario {
  return { ...(JSON.parse(JSON.stringify(BUILT_IN)) as Scenario), id, ...overrides };
}

function collection(overrides?: Partial<ScenarioCollection>): ScenarioCollection {
  return {
    id: 'ca1-fall-block',
    title: 'CA-1 fall block',
    scenarioIds: [BUILT_IN.id, 'my-custom-case'],
    createdAtIso: '2026-01-01T00:00:00.000Z',
    updatedAtIso: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function roundTrip(c: ScenarioCollection, custom: Scenario[]): CollectionBundle {
  const text = serializeCollectionBundle(c, new Map(custom.map((s) => [s.id, s])));
  const parsed = parseCollectionBundle(text);
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.bundle;
}

describe('slugifyCollectionId', () => {
  it('slugs to the scenario id charset', () => {
    expect(slugifyCollectionId('CA-1: Fall Block! (2026)', new Set())).toBe('ca-1-fall-block-2026');
  });

  it('falls back when no usable characters remain', () => {
    expect(slugifyCollectionId('!!! ***', new Set())).toBe('collection');
  });

  it('uniquifies against taken ids', () => {
    const taken = new Set(['oral-boards', 'oral-boards-2']);
    expect(slugifyCollectionId('Oral Boards', taken)).toBe('oral-boards-3');
  });
});

describe('collection bundle serialize/parse', () => {
  it('round-trips a collection with its custom scenarios, preserving order', () => {
    const custom = customScenario('my-custom-case');
    const c = collection();
    const bundle = roundTrip(c, [custom]);
    expect(bundle.collection).toEqual(c);
    expect(bundle.scenarios).toEqual([custom]);
    expect(bundle.collection.scenarioIds).toEqual([BUILT_IN.id, 'my-custom-case']);
  });

  it('embeds a custom scenario that shadows a built-in id', () => {
    const shadow = customScenario(BUILT_IN.id, { title: 'Local edit' });
    const c = collection({ scenarioIds: [BUILT_IN.id] });
    const bundle = roundTrip(c, [shadow]);
    expect(bundle.scenarios.map((s) => s.title)).toEqual(['Local edit']);
  });

  it('keeps unknown collection fields (passthrough) so newer files survive', () => {
    const c = { ...collection(), futureField: 'kept' } as ScenarioCollection;
    const bundle = roundTrip(c, [customScenario('my-custom-case')]);
    expect((bundle.collection as { futureField?: string }).futureField).toBe('kept');
  });

  it('rejects invalid JSON, wrong kind, and wrong formatVersion', () => {
    expect(parseCollectionBundle('{nope').ok).toBe(false);

    const wrongKind = roundTrip(collection(), []);
    expect(
      parseCollectionBundle(JSON.stringify({ ...wrongKind, kind: 'capno-session-export' })).ok,
    ).toBe(false);
    expect(parseCollectionBundle(JSON.stringify({ ...wrongKind, formatVersion: 2 })).ok).toBe(false);
  });

  it('rejects a malformed embedded scenario through the full scenario schema', () => {
    const bundle = JSON.parse(
      serializeCollectionBundle(collection(), new Map([['my-custom-case', customScenario('my-custom-case')]])),
    ) as { scenarios: Record<string, unknown>[] };
    delete bundle.scenarios[0].baselineVitals;
    const result = parseCollectionBundle(JSON.stringify(bundle));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/baselineVitals/);
  });

  it('rejects a malformed collection (bad id charset)', () => {
    const result = parseCollectionBundle(
      serializeCollectionBundle(collection({ id: 'Bad Id!' }), new Map()),
    );
    expect(result.ok).toBe(false);
  });

  it('sniffs bundle-shaped JSON for the unified import button', () => {
    expect(looksLikeCollectionBundle(JSON.parse(serializeCollectionBundle(collection(), new Map())))).toBe(true);
    expect(looksLikeCollectionBundle(JSON.parse(JSON.stringify(BUILT_IN)))).toBe(false);
    expect(looksLikeCollectionBundle(null)).toBe(false);
  });
});

describe('planBundleImport', () => {
  const ctx = (overrides?: Partial<Parameters<typeof planBundleImport>[1]>) => ({
    builtInIds: BUILT_IN_IDS,
    customById: new Map<string, Scenario>(),
    existingCollectionIds: new Set<string>(),
    ...overrides,
  });

  it('imports fresh scenarios and keeps the collection id when free', () => {
    const bundle = roundTrip(collection(), [customScenario('my-custom-case')]);
    const plan = planBundleImport(bundle, ctx());
    expect(plan.collection.id).toBe('ca1-fall-block');
    expect(plan.collectionIdRemapped).toBe(false);
    expect(plan.newScenarioIds).toEqual(['my-custom-case']);
    expect(plan.updatedScenarioIds).toEqual([]);
    expect(plan.missingRefs).toEqual([]);
  });

  it('suffixes the collection id on collision instead of clobbering', () => {
    const bundle = roundTrip(collection(), [customScenario('my-custom-case')]);
    const plan = planBundleImport(
      bundle,
      ctx({ existingCollectionIds: new Set(['ca1-fall-block']) }),
    );
    expect(plan.collection.id).toBe('ca1-fall-block-2');
    expect(plan.collectionIdRemapped).toBe(true);
    // Everything else survives the remap untouched.
    expect(plan.collection.scenarioIds).toEqual(bundle.collection.scenarioIds);
  });

  it('classifies an existing-but-different custom scenario as an update', () => {
    const local = customScenario('my-custom-case', { title: 'Old local title' });
    const bundle = roundTrip(collection(), [customScenario('my-custom-case')]);
    const plan = planBundleImport(bundle, ctx({ customById: new Map([[local.id, local]]) }));
    expect(plan.updatedScenarioIds).toEqual(['my-custom-case']);
    expect(plan.newScenarioIds).toEqual([]);
    expect(plan.scenariosToSave.map((s) => s.id)).toEqual(['my-custom-case']);
  });

  it('skips scenarios identical to the local head (re-imports burn no version slots)', () => {
    const same = customScenario('my-custom-case');
    const bundle = roundTrip(collection(), [same]);
    const plan = planBundleImport(
      bundle,
      ctx({ customById: new Map([[same.id, JSON.parse(JSON.stringify(same)) as Scenario]]) }),
    );
    expect(plan.skippedIdenticalIds).toEqual(['my-custom-case']);
    expect(plan.scenariosToSave).toEqual([]);
  });

  it('dedupes repeated refs (first occurrence wins) so remove/reorder stay well-defined', () => {
    const bundle = roundTrip(
      collection({ scenarioIds: [BUILT_IN.id, 'my-custom-case', BUILT_IN.id] }),
      [customScenario('my-custom-case')],
    );
    const plan = planBundleImport(bundle, ctx());
    expect(plan.collection.scenarioIds).toEqual([BUILT_IN.id, 'my-custom-case']);
  });

  it('reports refs that resolve nowhere, but never built-ins or quick-start', () => {
    const bundle = roundTrip(
      collection({ scenarioIds: [BUILT_IN.id, QUICK_START_ID, 'ghost-case'] }),
      [],
    );
    const plan = planBundleImport(bundle, ctx());
    expect(plan.missingRefs).toEqual(['ghost-case']);
    // The ghost ref is preserved in the imported collection regardless.
    expect(plan.collection.scenarioIds).toContain('ghost-case');
  });
});

describe('resolveRefs', () => {
  it('splits refs preserving order', () => {
    const { present, missing } = resolveRefs(['a', 'b', 'c'], (id) => id !== 'b');
    expect(present).toEqual(['a', 'c']);
    expect(missing).toEqual(['b']);
  });
});
