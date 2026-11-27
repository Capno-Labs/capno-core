import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_LABELS } from '@/components/editor/fieldLabels';
import { parseText } from '@/lib/import/parseText';
import { extractDrafts } from '@/lib/import/sections';
import { FIELD_SPECS, getField, labelForPath, rowIdForEntry } from './fieldRegistry';

const fields = () => {
  const md = readFileSync(path.join(__dirname, '../../lib/import/fixtures/sample-airway-guide.md'), 'utf8');
  return extractDrafts(parseText(md, 'guide.docx'), { sourceId: 'src', now: () => '2026-11-01T00:00:00.000Z' }).drafts[0].fields;
};

describe('import review field registry', () => {
  it('has a row for a real draft field at every path', () => {
    const f = fields();
    for (const spec of FIELD_SPECS) expect(getField(f, spec.path), spec.path).toHaveProperty('status');
  });

  it('calls each field what the case editor calls it', () => {
    for (const spec of FIELD_SPECS) {
      if (FIELD_LABELS[spec.path] && spec.path !== 'tags.topics') expect(spec.label, spec.path).toBe(FIELD_LABELS[spec.path]);
    }
    expect(FIELD_SPECS.find((s) => s.path === 'baselineVitals.hr')).toMatchObject({ label: 'Heart rate', unit: 'bpm' });
  });

  it('shows option names, not stored values', () => {
    const rhythm = FIELD_SPECS.find((s) => s.path === 'baselineVitals.rhythm')!;
    for (const option of rhythm.options!) expect(rhythm.optionLabels?.[String(option)], String(option)).toBeTruthy();
    const levels = FIELD_SPECS.find((s) => s.path === 'tags.trainingLevels')!;
    expect(levels.kind).toBe('enumList');
    expect(levels.optionLabels?.resident_junior).toBeTruthy();
  });

  it('labels a field still to decide', () => {
    const f = fields();
    expect(labelForPath('baselineVitals.hr', f)).toBe('Heart rate');
    expect(labelForPath('phases[0]', f)).toBe(`Phases: ${f.phases[0].value?.label}`);
    expect(rowIdForEntry('phases[0]')).toBe('field-phases[0]');
  });

  it('puts a schema problem in plain words and finds its row', () => {
    const f = fields();
    expect(labelForPath('patient.age: Number must be less than or equal to 120', f)).toBe('Age: Must be 120 or less.');
    expect(rowIdForEntry('patient.age: Number must be less than or equal to 120')).toBe('field-patient.age');
    expect(labelForPath('phases.0.label: String must contain at least 1 character(s)', f)).toBe(
      `Phases: ${f.phases[0].value?.label}: This cannot be blank.`,
    );
    expect(rowIdForEntry('events.2.effects.0.vitals.hr: Number must be less than or equal to 300')).toBe('field-events[2]');
    expect(rowIdForEntry('learningObjectives.1: Required')).toBe('field-learningObjectives');
    expect(rowIdForEntry('monitoring.nibpIntervalSec: Number must be greater than or equal to 15')).toBe('field-monitoring');
  });
});
