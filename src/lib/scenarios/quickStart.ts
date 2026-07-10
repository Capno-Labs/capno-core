import { parseScenario } from '../engine/schema';
import type { Scenario } from '../engine/types';
import { DEFAULT_VITALS } from '../engine/vitals';

/**
 * Quick-start scenario: a standardized healthy adult with normal baseline
 * vitals and no scripted events, for freeform instructor-driven sessions.
 *
 * Deliberately NOT part of BUILT_IN_SCENARIOS — the built-in library is
 * reviewed teaching content with a guarded minimum of events, actions, and
 * debrief material (see schema.test.ts), which a freeform session has no use
 * for. It is resolved by id in getScenario and pinned at the top of the
 * library page instead of appearing in the filterable list.
 */

export const QUICK_START_ID = 'quick-start';

export const QUICK_START_SCENARIO: Scenario = parseScenario({
  id: QUICK_START_ID,
  version: '1.0.0',
  title: 'Quick start — freeform session',
  summary:
    'Standardized healthy adult with normal baseline vitals and no scripted events. Drive everything live from the controller.',
  tags: {
    topics: ['general'],
    difficulty: 'beginner',
    trainingLevels: [
      'medical_student',
      'srna',
      'resident_junior',
      'resident_senior',
      'crna',
      'attending',
    ],
  },
  learningObjectives: ['Freeform practice — objectives are set by the instructor.'],
  setup: ['Standard OR setup with anesthesia machine and monitor.'],
  patient: {
    name: 'Alex Doe',
    age: 45,
    sex: 'male',
    weightKg: 80,
    heightCm: 175,
    asa: 2,
    allergies: [],
    medications: [],
    pmh: [],
    airway: { mallampati: 1 },
  },
  baselineVitals: { ...DEFAULT_VITALS },
  phases: [{ id: 'main', label: 'Main phase' }],
  events: [],
  expectedActions: [
    {
      id: 'instructor-noted-action',
      label: 'Instructor-noted action (freeform session)',
      critical: false,
      points: 10,
    },
  ],
  expectedProgression: [],
  correctManagement: [],
  commonErrors: [],
  debrief: { points: [], questions: [] },
  rubric: [{ id: 'overall', label: 'Overall', actionIds: ['instructor-noted-action'] }],
  estimatedMinutes: 15,
});
