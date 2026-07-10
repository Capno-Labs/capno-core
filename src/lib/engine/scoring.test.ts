import { describe, expect, it } from 'vitest';
import { scoreSession } from './scoring';
import type { ActionRecord, Scenario } from './types';
import { DEFAULT_VITALS } from './vitals';

function fixture(): Scenario {
  return {
    id: 'test',
    version: '1.0.0',
    title: 'Test',
    summary: 'test',
    tags: { topics: ['t'], difficulty: 'beginner', trainingLevels: ['srna'] },
    learningObjectives: ['x'],
    setup: [],
    patient: {
      name: 'T',
      age: 30,
      sex: 'female',
      weightKg: 70,
      heightCm: 170,
      asa: 1,
      allergies: [],
      medications: [],
      pmh: [],
      airway: { mallampati: 1 },
    },
    baselineVitals: { ...DEFAULT_VITALS },
    phases: [{ id: 'main', label: 'Main' }],
    events: [],
    expectedActions: [
      { id: 'a1', label: 'A1', critical: true, points: 20 },
      { id: 'a2', label: 'A2', critical: false, points: 10 },
      { id: 'a3', label: 'A3', critical: false, points: 10 },
      { id: 'a4', label: 'A4 (uncategorized)', critical: false, points: 5 },
    ],
    expectedProgression: [],
    correctManagement: [],
    commonErrors: [],
    debrief: { points: [], questions: [] },
    rubric: [
      { id: 'recognition', label: 'Recognition', actionIds: ['a1', 'a2'] },
      { id: 'management', label: 'Management', actionIds: ['a3'] },
    ],
    estimatedMinutes: 10,
  };
}

describe('scoreSession', () => {
  it('awards full, half, and zero credit by status', () => {
    const records: ActionRecord[] = [
      { actionId: 'a1', status: 'done', markedAtSec: 10 },
      { actionId: 'a2', status: 'delayed', markedAtSec: 200 },
      { actionId: 'a3', status: 'incorrect', markedAtSec: 30 },
      { actionId: 'a4', status: 'missed' },
    ];
    const report = scoreSession(fixture(), records);
    expect(report.possible).toBe(45);
    expect(report.earned).toBe(25); // 20 + 5 + 0 + 0
    expect(report.percent).toBe(56);
  });

  it('groups scores by rubric category and adds an uncategorized bucket', () => {
    const records: ActionRecord[] = [
      { actionId: 'a1', status: 'done' },
      { actionId: 'a2', status: 'missed' },
      { actionId: 'a3', status: 'done' },
      { actionId: 'a4', status: 'done' },
    ];
    const report = scoreSession(fixture(), records);
    const rec = report.categories.find((c) => c.categoryId === 'recognition')!;
    expect(rec.earned).toBe(20);
    expect(rec.possible).toBe(30);
    const other = report.categories.find((c) => c.categoryId === '_uncategorized')!;
    expect(other.possible).toBe(5);
    expect(other.earned).toBe(5);
  });

  it('reports critical actions missed unless done', () => {
    const report = scoreSession(fixture(), [
      { actionId: 'a1', status: 'delayed' }, // half credit but still "not completed"
    ]);
    expect(report.criticalMissed.map((a) => a.id)).toEqual(['a1']);
    expect(report.criticalDone).toHaveLength(0);
  });

  it('handles empty records (all pending → zero)', () => {
    const report = scoreSession(fixture(), []);
    expect(report.earned).toBe(0);
    expect(report.percent).toBe(0);
  });
});
