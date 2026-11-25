import { describe, expect, it } from 'vitest';
import { BUILT_IN_SCENARIOS } from '@/lib/scenarios/registry';
import { SECTIONS, sectionOfHash, sectionOfIssue, sectionOfPath } from './sections';

describe('editor sections', () => {
  it('gives every top-level scenario key a section', () => {
    const keys = new Set(BUILT_IN_SCENARIOS.flatMap((s) => Object.keys(s)));
    for (const key of keys) expect(sectionOfPath(key), key).not.toBeNull();
  });

  it('routes nested paths by their first key', () => {
    expect(sectionOfPath('events.3.effects.0.vitals.hr')).toBe('progression');
    expect(sectionOfPath('baselineVitals.dbp')).toBe('start');
    expect(sectionOfPath('learningObjectives.0')).toBe('basics');
    expect(sectionOfPath('rubric.0.actionIds.1')).toBe('review');
    expect(sectionOfPath('nonsense')).toBeNull();
  });

  it('reads the section out of a validation issue', () => {
    expect(sectionOfIssue('patient.age: Number must be less than or equal to 120')).toBe('patient');
    expect(sectionOfIssue('Invalid JSON: unexpected token')).toBeNull();
    expect(sectionOfIssue('no colon here')).toBeNull();
  });

  it('resolves current and pre-redesign hashes', () => {
    for (const s of SECTIONS) expect(sectionOfHash(`#${s.id}`)).toBe(s.id);
    expect(sectionOfHash('#timeline')).toBe('progression');
    expect(sectionOfHash('#assessment')).toBe('progression');
    expect(sectionOfHash('#vitals')).toBe('start');
    expect(sectionOfHash('#history')).toBe('review');
    expect(sectionOfHash('#nope')).toBeNull();
    expect(sectionOfHash('')).toBeNull();
  });
});
