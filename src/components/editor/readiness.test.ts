import { describe, expect, it } from 'vitest';
import { lintScenario } from '@/lib/engine/lint';
import { validateScenario } from '@/lib/engine/schema';
import type { Scenario } from '@/lib/engine/types';
import { BUILT_IN_SCENARIOS } from '@/lib/scenarios/registry';
import { itemsFor, plainMessage, readinessItems } from './readiness';

const anaphylaxis = () =>
  JSON.parse(JSON.stringify(BUILT_IN_SCENARIOS.find((s) => s.id === 'anaphylaxis'))) as Scenario;

const check = (s: Scenario) => readinessItems(s, validateScenario(s).errors, lintScenario(s));
const at = (s: Scenario, path: string) => check(s).find((item) => item.path === path);

/** Nothing a reader of the form could not make sense of. */
const RAW = /\b(events|phases|expectedActions|rubric|baselineVitals|tags)\.\w|must contain at least|received|Invalid enum|\bid\b/;

describe('readiness checklist', () => {
  it('has nothing to fix in any built-in case', () => {
    for (const s of BUILT_IN_SCENARIOS) {
      expect(check(s).filter((item) => item.level === 'fix'), s.id).toEqual([]);
    }
  });

  it('names a plain field by its label', () => {
    const s = anaphylaxis();
    s.title = '';
    expect(at(s, 'title')).toMatchObject({
      level: 'fix',
      section: 'basics',
      where: 'Title',
      field: 'Title',
      message: 'This cannot be blank.',
    });
  });

  it('names a starting vital and says the limit', () => {
    const s = anaphylaxis();
    s.baselineVitals.hr = 400;
    expect(at(s, 'baselineVitals.hr')).toMatchObject({
      section: 'start',
      where: 'Heart rate',
      message: 'Must be 300 or less.',
    });
  });

  it('explains the pulse-pressure rule without field keys', () => {
    const s = anaphylaxis();
    s.baselineVitals.dbp = s.baselineVitals.sbp;
    const item = at(s, 'baselineVitals.dbp');
    expect(item?.where).toBe('Diastolic BP');
    expect(item?.message).toMatch(/^Diastolic BP must be at least \d+ mmHg below systolic BP\.$/);
  });

  it('names an event by its label and points at its card', () => {
    const s = anaphylaxis();
    const i = s.events.findIndex((e) => e.effects.some((fx) => fx.vitals));
    s.events[i].effects[0].vitals = { ...s.events[i].effects[0].vitals, hr: 999 };
    const item = check(s).find((x) => x.path === `events.${i}.effects.0.vitals.hr`);
    expect(item).toMatchObject({
      level: 'fix',
      section: 'progression',
      anchorId: `event-${s.events[i].id}`,
      field: 'Heart rate',
    });
    expect(item?.where).toContain(`“${s.events[i].label}”`);
    expect(item?.where).toContain('Heart rate');
  });

  it('says which change when an event has several', () => {
    const s = anaphylaxis();
    s.events[0].effects = [{}, { overSec: -5 }];
    expect(at(s, 'events.0.effects.1.overSec')).toMatchObject({ field: 'Takes', message: 'Must be 0 or more.' });
    expect(at(s, 'events.0.effects.1.overSec')?.where).toContain('(change 2)');
  });

  it('still places an unnamed phase, event or action', () => {
    const s = anaphylaxis();
    s.phases[1].label = '';
    s.events[2].label = '';
    s.expectedActions[0].label = '';
    expect(at(s, 'phases.1.label')).toMatchObject({ where: 'Phase 2, name', anchorId: `phase-${s.phases[1].id}` });
    expect(at(s, 'events.2.label')).toMatchObject({ where: 'An unnamed event, What happens', field: 'What happens' });
    expect(at(s, 'expectedActions.0.label')).toMatchObject({
      where: 'An unnamed action',
      anchorId: `action-${s.expectedActions[0].id}`,
    });
  });

  it('sends scoring problems to Review & publish', () => {
    const s = anaphylaxis();
    s.rubric[0].actionIds.push('no-such-action');
    const item = check(s).find((x) => x.path.startsWith('rubric.0.actionIds'));
    expect(item).toMatchObject({ level: 'fix', section: 'review', anchorId: 'rubric-0' });
    expect(item?.where).toBe(`Scoring category “${s.rubric[0].label}”`);
    expect(item?.message).toContain('no longer exists');
  });

  it('turns authoring notes into "worth a look" items on their event', () => {
    const s = anaphylaxis();
    s.events[1].phaseHint = 'no-such-phase';
    s.events[1].autoAtSec = s.estimatedMinutes * 60 + 60;
    const items = check(s).filter((x) => x.path.startsWith('events.1.'));
    expect(items.map((x) => x.level)).toEqual(['look', 'look']);
    expect(items.map((x) => x.field)).toEqual(['Phase', 'At']);
    expect(itemsFor(check(s), 'progression')).toEqual(expect.arrayContaining(items));
  });

  it('never shows a JSON path or a schema phrase', () => {
    const s = anaphylaxis();
    s.title = '';
    s.summary = '';
    s.tags.trainingLevels = [];
    s.tags.topics = [];
    s.learningObjectives = [];
    s.patient.name = '';
    s.patient.age = 300;
    s.patient.airway.mallampati = 7 as never;
    s.baselineVitals.spo2 = 140;
    s.baselineVitals.rhythm = 'nonsense' as never;
    s.monitoring = { nibpIntervalSec: 5 };
    s.phases[0].label = '';
    s.events[0].label = '';
    s.events[0].autoAtSec = -1;
    s.events[1].category = 'nope' as never;
    s.events[1].actionIds = ['gone'];
    s.events[2].id = s.events[1].id;
    s.expectedActions[0].points = 1.5;
    s.expectedActions[1].phase = 'gone';
    s.rubric[0].label = '';
    s.version = '';
    const items = check(s).filter((x) => x.level === 'fix');
    // Cross-reference checks only run once the shape is valid; they are covered below.
    expect(items.length).toBeGreaterThanOrEqual(15);
    for (const item of items) {
      expect(item.section, item.path).not.toBeNull();
      expect(`${item.where} — ${item.message}`, item.path).not.toMatch(RAW);
      expect(item.where, item.path).not.toBe(item.path);
    }
  });

  it('explains broken links between events, actions and phases', () => {
    const s = anaphylaxis();
    s.events[1].actionIds = ['gone'];
    s.events[2].id = s.events[1].id;
    s.expectedActions[1].phase = 'gone';
    const items = check(s).filter((x) => x.level === 'fix');
    expect(items).toHaveLength(3);
    for (const item of items) expect(`${item.where} — ${item.message}`, item.path).not.toMatch(RAW);
    expect(at(s, 'expectedActions.1.phase')).toMatchObject({ field: 'Phase' });
  });

  it('keeps a message it does not know, as a sentence', () => {
    expect(plainMessage('high limit must be above the low limit')).toBe('High limit must be above the low limit.');
  });

  it('keeps pathless problems, with no section', () => {
    const [item] = readinessItems(anaphylaxis(), ['Invalid JSON: Unexpected token }'], []);
    expect(item).toMatchObject({ level: 'fix', section: null, message: 'Invalid JSON: Unexpected token }.' });
  });
});
