import { describe, expect, it } from 'vitest';
import type { ScenarioEvent } from '../engine/types';
import {
  MAX_EVENTS,
  isDuplicate,
  newSavedEventId,
  parseLibraryFile,
  payloadFromEvent,
  planLibraryImport,
  serializeLibraryFile,
  type SavedEvent,
} from './eventLibrary';

const sourceEvent: ScenarioEvent = {
  id: 'epi-response',
  label: 'Epinephrine response',
  description: 'BP recovers over a minute.',
  category: 'drug',
  effects: [{ vitals: { sbp: 110, dbp: 70, hr: 95 }, overSec: 60 }],
  autoAtSec: 300,
  phaseHint: 'management',
  actionIds: ['give-epi'],
};

function entry(overrides: Partial<SavedEvent> = {}): SavedEvent {
  return {
    id: 'epinephrine-response',
    label: 'Epinephrine response',
    description: 'BP recovers over a minute.',
    category: 'drug',
    effects: [{ vitals: { sbp: 110, dbp: 70, hr: 95 }, overSec: 60 }],
    savedAtIso: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('payloadFromEvent', () => {
  it('strips scenario-specific fields', () => {
    const payload = payloadFromEvent(sourceEvent);
    expect(payload).toEqual({
      label: 'Epinephrine response',
      description: 'BP recovers over a minute.',
      category: 'drug',
      effects: sourceEvent.effects,
    });
    expect('id' in payload).toBe(false);
    expect('autoAtSec' in payload).toBe(false);
    expect('phaseHint' in payload).toBe(false);
    expect('actionIds' in payload).toBe(false);
  });

  it('deep-copies effects so source mutations do not leak', () => {
    const source = structuredClone(sourceEvent);
    const payload = payloadFromEvent(source);
    source.effects[0].vitals!.sbp = 0;
    expect(payload.effects[0].vitals!.sbp).toBe(110);
  });

  it('omits an empty description and trims the label', () => {
    const payload = payloadFromEvent({ ...sourceEvent, label: '  Epi  ', description: undefined });
    expect(payload.label).toBe('Epi');
    expect('description' in payload).toBe(false);
  });
});

describe('newSavedEventId', () => {
  it('slugifies the label', () => {
    expect(newSavedEventId('Surgeon reports brisk bleeding!', new Set())).toBe(
      'surgeon-reports-brisk-bleeding',
    );
  });

  it('uniquifies against taken ids', () => {
    const taken = new Set(['epi', 'epi-2']);
    expect(newSavedEventId('Epi', taken)).toBe('epi-3');
  });

  it('falls back for garbage labels', () => {
    expect(newSavedEventId('★★★', new Set())).toBe('event');
  });
});

describe('isDuplicate', () => {
  it('matches exact content regardless of id/savedAtIso', () => {
    const payload = payloadFromEvent(sourceEvent);
    expect(isDuplicate(payload, [entry({ id: 'other-id', savedAtIso: 'whenever' })])).toBe(true);
  });

  it('does not match when content differs', () => {
    const payload = payloadFromEvent({ ...sourceEvent, label: 'Different label' });
    expect(isDuplicate(payload, [entry()])).toBe(false);
    const changedEffects = payloadFromEvent({
      ...sourceEvent,
      effects: [{ vitals: { sbp: 90 } }],
    });
    expect(isDuplicate(changedEffects, [entry()])).toBe(false);
  });
});

describe('library file round-trip', () => {
  it('serializes and parses back', () => {
    const text = serializeLibraryFile([entry()]);
    const result = parseLibraryFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.kind).toBe('capno-event-library');
      expect(result.file.events).toHaveLength(1);
      expect(result.file.events[0].label).toBe('Epinephrine response');
    }
  });

  it('rejects invalid JSON with a readable error', () => {
    const result = parseLibraryFile('{nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^Invalid JSON/);
  });

  it('rejects a wrong kind', () => {
    const result = parseLibraryFile(
      JSON.stringify({ kind: 'capno-collection-bundle', formatVersion: 1, exportedAtIso: '', events: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Not a valid Capno event-library file/);
  });

  it('rejects a bad category and a malformed effect', () => {
    const badCategory = parseLibraryFile(
      serializeLibraryFile([entry({ category: 'nonsense' as SavedEvent['category'] })]),
    );
    expect(badCategory.ok).toBe(false);

    const badEffect = parseLibraryFile(
      serializeLibraryFile([
        entry({ effects: [{ vitals: { sbp: 100, dbp: 95 } }] }), // pulse-pressure violation
      ]),
    );
    expect(badEffect.ok).toBe(false);
  });

  it('rejects a missing label', () => {
    const result = parseLibraryFile(serializeLibraryFile([entry({ label: '' })]));
    expect(result.ok).toBe(false);
  });
});

describe('planLibraryImport', () => {
  it('skips exact duplicates, including within the incoming file', () => {
    const plan = planLibraryImport([entry(), entry({ id: 'copy' })], [entry()]);
    expect(plan.toAdd).toHaveLength(0);
    expect(plan.skippedDuplicates).toBe(2);
  });

  it('remaps colliding ids and keeps distinct content', () => {
    const incoming = entry({ label: 'Different content' });
    const plan = planLibraryImport([incoming], [entry()]);
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.toAdd[0].id).toBe('epinephrine-response-2');
    expect(plan.skippedDuplicates).toBe(0);
  });

  it('drops non-duplicate entries past the cap and reports the count', () => {
    const existing = Array.from({ length: MAX_EVENTS - 1 }, (_, i) =>
      entry({ id: `e-${i}`, label: `Event ${i}` }),
    );
    const incoming = [
      entry({ id: 'in-1', label: 'Incoming one' }),
      entry({ id: 'in-2', label: 'Incoming two' }),
    ];
    const plan = planLibraryImport(incoming, existing);
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.droppedOverCap).toBe(1);
  });
});
