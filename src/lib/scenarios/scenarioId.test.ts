import { describe, expect, it } from 'vitest';
import { validateScenario } from '../engine/schema';
import { BUILT_IN_SCENARIOS } from './registry';
import {
  NEW_SCENARIO_ID,
  copyTitle,
  duplicateScenario,
  freeScenarioId,
  scenarioIdFromTitle,
  slugifyScenarioTitle,
  templateFrom,
} from './scenarioId';

describe('slugifyScenarioTitle', () => {
  it('makes a schema-valid kebab id', () => {
    expect(slugifyScenarioTitle('  Laryngospasm — after LMA removal! ')).toBe(
      'laryngospasm-after-lma-removal',
    );
    expect(slugifyScenarioTitle('Événement bronchospasme')).toBe('evenement-bronchospasme');
  });

  it('returns an empty string when nothing is usable', () => {
    expect(slugifyScenarioTitle('—!!—')).toBe('');
  });

  it('never ends on a dash after truncation', () => {
    const slug = slugifyScenarioTitle(`${'a'.repeat(59)} b c`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('scenarioIdFromTitle', () => {
  it('avoids ids already in use', () => {
    const taken = new Set(['anaphylaxis', 'anaphylaxis-2']);
    expect(scenarioIdFromTitle('Anaphylaxis', taken)).toBe('anaphylaxis-3');
  });

  it('falls back when the title has no usable characters', () => {
    expect(scenarioIdFromTitle('???', new Set())).toBe('case');
  });

  it('never returns the unsaved placeholder', () => {
    expect(scenarioIdFromTitle('My new scenario', new Set())).not.toBe(NEW_SCENARIO_ID);
  });
});

describe('copyTitle', () => {
  it('numbers repeated copies instead of stacking suffixes', () => {
    expect(copyTitle('MH crisis', new Set())).toBe('MH crisis (copy)');
    expect(copyTitle('MH crisis (copy)', new Set(['MH crisis (copy)']))).toBe('MH crisis (copy 2)');
    expect(copyTitle('MH crisis (copy 2)', new Set(['MH crisis (copy)', 'MH crisis (copy 2)']))).toBe(
      'MH crisis (copy 3)',
    );
  });
});

describe('duplicateScenario', () => {
  const ids = new Set(BUILT_IN_SCENARIOS.map((s) => s.id));
  const titles = new Set(BUILT_IN_SCENARIOS.map((s) => s.title));

  it('gives every built-in a valid copy with its own id', () => {
    for (const source of BUILT_IN_SCENARIOS) {
      const copy = duplicateScenario(source, ids, titles);
      expect(ids.has(copy.id)).toBe(false);
      expect(copy.title).toBe(`${source.title} (copy)`);
      expect(validateScenario(copy).ok).toBe(true);
      expect({ ...copy, id: source.id, title: source.title }).toEqual(source);
    }
  });

  it('does not share nested objects with the source', () => {
    const source = BUILT_IN_SCENARIOS[0];
    const copy = duplicateScenario(source, ids, titles);
    expect(copy.patient).not.toBe(source.patient);
    expect(copy.tags.topics).not.toBe(source.tags.topics);
  });
});

describe('templateFrom', () => {
  it('keeps the placeholder id until first save', () => {
    expect(templateFrom(BUILT_IN_SCENARIOS[0], new Set()).id).toBe(NEW_SCENARIO_ID);
  });
});

describe('freeScenarioId', () => {
  const cloud = (ids: string[]) => async (candidates: string[]) =>
    new Set(candidates.filter((c) => ids.includes(c)));

  it('keeps the id when it is free here and in the cloud', async () => {
    expect(await freeScenarioId('knee-arthroscopy', new Set(), cloud([]))).toEqual({
      id: 'knee-arthroscopy',
      checked: true,
    });
  });

  it('skips ids another organization already uses', async () => {
    const lookup = cloud(['knee-arthroscopy', 'knee-arthroscopy-2']);
    expect((await freeScenarioId('knee-arthroscopy', new Set(), lookup)).id).toBe('knee-arthroscopy-3');
  });

  it('skips ids used on this device without asking about them', async () => {
    const asked: string[][] = [];
    const lookup = async (candidates: string[]) => {
      asked.push(candidates);
      return new Set(['case-2']);
    };
    const { id } = await freeScenarioId('case', new Set(['case']), lookup);
    expect(id).toBe('case-3');
    expect(asked[0]).not.toContain('case');
  });

  it('falls back to the locally free id when the cloud cannot answer', async () => {
    expect(await freeScenarioId('case', new Set(['case']), async () => null)).toEqual({
      id: 'case-2',
      checked: false,
    });
  });

  it('gives up after a few rounds instead of looping', async () => {
    let rounds = 0;
    const everythingTaken = async (candidates: string[]) => {
      rounds += 1;
      return new Set(candidates);
    };
    expect(await freeScenarioId('case', new Set(), everythingTaken)).toEqual({ id: 'case', checked: false });
    expect(rounds).toBe(3);
  });
});
